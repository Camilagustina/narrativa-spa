export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  if (!token || !repo) {
    return res.status(500).json({ 
      error: 'Variables de entorno GITHUB_TOKEN y GITHUB_REPO no configuradas en el servidor.' 
    });
  }

  try {
    const { title, narrator, genre, synopsis, cover, text, audioName, audioBase64 } = req.body;

    if (!title || !narrator || !genre || !audioName || !audioBase64) {
      return res.status(400).json({ error: 'Faltan campos obligatorios en el formulario.' });
    }

    // Clean base64 string if it contains the Data URL prefix
    let cleanBase64 = audioBase64;
    if (audioBase64.includes(';base64,')) {
      cleanBase64 = audioBase64.split(';base64,')[1];
    }

    // 1. Upload audio file to GitHub: audios/filename.mp3
    console.log(`Subiendo audio "${audioName}" a GitHub...`);
    const uploadAudioUrl = `https://api.github.com/repos/${repo}/contents/audios/${audioName}`;
    const uploadAudioRes = await fetch(uploadAudioUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Narrativa-Vercel-Backend'
      },
      body: JSON.stringify({
        message: `Subida de audio: ${title}`,
        content: cleanBase64
      })
    });

    if (!uploadAudioRes.ok) {
      const errText = await uploadAudioRes.text();
      throw new Error(`Fallo al subir audio a GitHub: ${uploadAudioRes.status} - ${errText}`);
    }

    // The raw download URL for the audio file on GitHub
    const publicAudioUrl = `https://raw.githubusercontent.com/${repo}/main/audios/${audioName}`;
    console.log(`Audio subido con éxito. URL pública: ${publicAudioUrl}`);

    // 2. Fetch current db.json metadata from GitHub to get its SHA and content
    console.log('Obteniendo base de datos actual db.json de GitHub...');
    const getDbUrl = `https://api.github.com/repos/${repo}/contents/db.json`;
    const getDbRes = await fetch(getDbUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Narrativa-Vercel-Backend'
      }
    });

    let currentStories = [];
    let dbSha = null;

    if (getDbRes.status === 200) {
      const dbMeta = await getDbRes.json();
      dbSha = dbMeta.sha;
      // Decode content from base64
      const decodedContent = Buffer.from(dbMeta.content, 'base64').toString('utf8');
      currentStories = JSON.parse(decodedContent);
    } else if (getDbRes.status === 404) {
      console.log('El archivo db.json no existe en el repositorio. Se creará uno nuevo.');
    } else {
      const errText = await getDbRes.text();
      throw new Error(`Fallo al leer db.json de GitHub: ${getDbRes.status} - ${errText}`);
    }

    // 3. Construct new story object
    const newStory = {
      id: `story-${Date.now()}`,
      title,
      narrator,
      genre,
      audioUrl: publicAudioUrl,
      cover,
      synopsis,
      text
    };

    // Append to list
    currentStories.push(newStory);

    // 4. Write db.json back to GitHub
    console.log('Guardando base de datos actualizada en GitHub...');
    const updatedDbString = JSON.stringify(currentStories, null, 2);
    const updatedDbBase64 = Buffer.from(updatedDbString, 'utf8').toString('base64');

    const updateDbPayload = {
      message: `Agregar cuento: ${title}`,
      content: updatedDbBase64
    };

    // Include SHA if updating an existing file
    if (dbSha) {
      updateDbPayload.sha = dbSha;
    }

    const updateDbRes = await fetch(getDbUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Narrativa-Vercel-Backend'
      },
      body: JSON.stringify(updateDbPayload)
    });

    if (!updateDbRes.ok) {
      const errText = await updateDbRes.text();
      throw new Error(`Fallo al actualizar db.json en GitHub: ${updateDbRes.status} - ${errText}`);
    }

    console.log(`Relato "${title}" publicado con éxito en la plataforma.`);
    return res.status(200).json({ success: true, story: newStory });

  } catch (err) {
    console.error("Error en el proceso de subida:", err);
    return res.status(500).json({ error: `Error en la subida: ${err.message}` });
  }
}
