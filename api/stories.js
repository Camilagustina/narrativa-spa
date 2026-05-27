import { readFileSync } from 'fs';
import { join } from 'path';

export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  // Local fallback
  const getLocalDb = () => {
    try {
      const filePath = join(process.cwd(), 'db.json');
      const fileData = readFileSync(filePath, 'utf8');
      return JSON.parse(fileData);
    } catch (e) {
      console.error("Local database read failed:", e);
      return [];
    }
  };

  if (!token || !repo) {
    console.warn("GITHUB_TOKEN or GITHUB_REPO environment variables not set. Serving local db.json.");
    return res.status(200).json(getLocalDb());
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/db.json`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3.raw',
        'User-Agent': 'Narrativa-Vercel-Backend'
      }
    });

    if (response.ok) {
      const dbText = await response.text();
      let storiesList = JSON.parse(dbText);
      
      // --- 15-DAY EXPIRATION AUTO-CLEANUP ---
      const now = new Date();
      const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
      let hasChanges = false;
      const cleanStories = [];

      for (const story of storiesList) {
        if (story.deleted && story.deletedAt) {
          const deletedTime = new Date(story.deletedAt);
          if (now - deletedTime > FIFTEEN_DAYS_MS) {
            console.log(`Auto-purgando relato "${story.title}" por expirar 15 días.`);
            hasChanges = true;
            
            // Attempt to purge the audio file
            const audioUrl = story.audioUrl;
            const audioPrefix = `https://raw.githubusercontent.com/${repo}/main/audios/`;
            
            if (audioUrl && audioUrl.startsWith(audioPrefix)) {
              const audioName = audioUrl.substring(audioPrefix.length);
              try {
                const audioFileUrl = `https://api.github.com/repos/${repo}/contents/audios/${audioName}`;
                const fileMetaRes = await fetch(audioFileUrl, {
                  headers: { 'Authorization': `token ${token}`, 'User-Agent': 'Narrativa-Vercel-Backend' }
                });
                
                if (fileMetaRes.status === 200) {
                  const fileMeta = await fileMetaRes.json();
                  await fetch(audioFileUrl, {
                    method: 'DELETE',
                    headers: {
                      'Authorization': `token ${token}`,
                      'Content-Type': 'application/json',
                      'User-Agent': 'Narrativa-Vercel-Backend'
                    },
                    body: JSON.stringify({
                      message: `Auto-purga de audio (Expiró 15 días): ${story.title}`,
                      sha: fileMeta.sha
                    })
                  });
                  console.log(`Archivo de audio "${audioName}" eliminado físicamente de GitHub.`);
                }
              } catch (e) {
                console.error(`Error al auto-purgar archivo de audio para "${story.title}":`, e);
              }
            }
            // Skip adding to cleanStories
            continue;
          }
        }
        cleanStories.push(story);
      }

      if (hasChanges) {
        console.log("Aplicando auto-purga en db.json y actualizando GitHub...");
        
        // Fetch current db.json metadata to get SHA
        const getMetaUrl = `https://api.github.com/repos/${repo}/contents/db.json`;
        const metaRes = await fetch(getMetaUrl, {
          headers: {
            'Authorization': `token ${token}`,
            'User-Agent': 'Narrativa-Vercel-Backend'
          }
        });
        
        if (metaRes.status === 200) {
          const dbMeta = await metaRes.json();
          const dbSha = dbMeta.sha;
          
          const updatedDbString = JSON.stringify(cleanStories, null, 2);
          const updatedDbBase64 = Buffer.from(updatedDbString, 'utf8').toString('base64');
          
          await fetch(getMetaUrl, {
            method: 'PUT',
            headers: {
              'Authorization': `token ${token}`,
              'Content-Type': 'application/json',
              'User-Agent': 'Narrativa-Vercel-Backend'
            },
            body: JSON.stringify({
              message: "Auto-purga automática: relatos expirados tras 15 días",
              content: updatedDbBase64,
              sha: dbSha
            })
          });
          console.log("Base de datos depurada correctamente en GitHub.");
        }
        
        storiesList = cleanStories;
      }

      return res.status(200).json(storiesList);
    } else {
      console.warn(`GitHub fetch failed with status: ${response.status}. Serving local fallback.`);
      return res.status(200).json(getLocalDb());
    }
  } catch (err) {
    console.error("Error fetching remote database:", err);
    return res.status(200).json(getLocalDb());
  }
}
