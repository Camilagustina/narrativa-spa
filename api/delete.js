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
    const { storyId, action } = req.body;

    if (!storyId || !action) {
      return res.status(400).json({ error: 'Faltan parámetros obligatorios: storyId y action.' });
    }

    // 1. Fetch current db.json metadata from GitHub
    console.log('Obteniendo base de datos actual db.json de GitHub...');
    const getDbUrl = `https://api.github.com/repos/${repo}/contents/db.json`;
    const getDbRes = await fetch(getDbUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Narrativa-Vercel-Backend'
      }
    });

    if (getDbRes.status !== 200) {
      const errText = await getDbRes.text();
      throw new Error(`Fallo al leer db.json de GitHub: ${getDbRes.status} - ${errText}`);
    }

    const dbMeta = await getDbRes.json();
    const dbSha = dbMeta.sha;
    const decodedContent = Buffer.from(dbMeta.content, 'base64').toString('utf8');
    const storiesList = JSON.parse(decodedContent);

    // Find the story
    const storyIdx = storiesList.findIndex(s => s.id === storyId);
    if (storyIdx === -1) {
      return res.status(404).json({ error: 'Relato no encontrado en la base de datos.' });
    }

    const targetStory = storiesList[storyIdx];

    if (action === 'delete') {
      // --- SOFT DELETE ---
      console.log(`Marcando relato "${targetStory.title}" como eliminado (Papelera)...`);
      targetStory.deleted = true;
      targetStory.deletedAt = new Date().toISOString();
      
    } else if (action === 'restore') {
      // --- RESTORE ---
      console.log(`Restaurando relato "${targetStory.title}" de la papelera...`);
      delete targetStory.deleted;
      delete targetStory.deletedAt;
      
    } else if (action === 'permanent') {
      // --- PERMANENT PURGE ---
      console.log(`Borrando relato "${targetStory.title}" de forma permanente...`);
      
      // Parse file name from audioUrl if it is hosted on GitHub
      const audioUrl = targetStory.audioUrl;
      const audioPrefix = `https://raw.githubusercontent.com/${repo}/main/audios/`;
      
      if (audioUrl && audioUrl.startsWith(audioPrefix)) {
        const audioName = audioUrl.substring(audioPrefix.Length);
        console.log(`Identificado archivo de audio a purgar en GitHub: ${audioName}`);
        
        // Fetch audio file metadata from GitHub to get SHA
        const audioFileMetaUrl = `https://api.github.com/repos/${repo}/contents/audios/${audioName}`;
        const audioFileMetaRes = await fetch(audioFileMetaUrl, {
          headers: {
            'Authorization': `token ${token}`,
            'User-Agent': 'Narrativa-Vercel-Backend'
          }
        });
        
        if (audioFileMetaRes.status === 200) {
          const audioFileMeta = await audioFileMetaRes.json();
          const fileSha = audioFileMeta.sha;
          
          // Send DELETE request for the audio file
          console.log(`Eliminando archivo físico de audio de GitHub: ${audioName}...`);
          const deleteFileRes = await fetch(audioFileMetaUrl, {
            method: 'DELETE',
            headers: {
              'Authorization': `token ${token}`,
              'Content-Type': 'application/json',
              'User-Agent': 'Narrativa-Vercel-Backend'
            },
            body: JSON.stringify({
              message: `Purga permanente de audio: ${targetStory.title}`,
              sha: fileSha
            })
          });
          
          if (deleteFileRes.ok) {
            console.log("Archivo de audio eliminado físicamente de GitHub.");
          } else {
            console.error(`Fallo al eliminar archivo de audio físico: ${deleteFileRes.status}`);
          }
        }
      }
      
      // Remove metadata record from array
      storiesList.splice(storyIdx, 1);
    } else {
      return res.status(400).json({ error: 'Acción no válida. Se requiere: delete, restore, permanent.' });
    }

    // 2. Commit updated db.json back to GitHub
    console.log('Actualizando base de datos en GitHub...');
    const updatedDbString = JSON.stringify(storiesList, null, 2);
    const updatedDbBase64 = Buffer.from(updatedDbString, 'utf8').toString('base64');

    const updateDbRes = await fetch(getDbUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Narrativa-Vercel-Backend'
      },
      body: JSON.stringify({
        message: `Base de datos actualizada (${action}): ${targetStory.title}`,
        content: updatedDbBase64,
        sha: dbSha
      })
    });

    if (!updateDbRes.ok) {
      const errText = await updateDbRes.text();
      throw new Error(`Fallo al escribir db.json actualizado en GitHub: ${updateDbRes.status} - ${errText}`);
    }

    console.log(`Operación "${action}" completada con éxito.`);
    return res.status(200).json({ success: true, storyId, action });

  } catch (err) {
    console.error("Error en la operación del backend:", err);
    return res.status(500).json({ error: `Fallo en el backend: ${err.message}` });
  }
}
