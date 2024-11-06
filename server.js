const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

// Connexion à la base de données PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test de connexion à la base de données
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ success: true, time: result.rows[0].now });
  } catch (error) {
    console.error('Erreur lors de la connexion à la base de données', error);
    res.json({ success: false });
  }
});

// Connexion d'un utilisateur (enfant)
app.post('/login', async (req, res) => {
  const { username } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erreur lors de la connexion de l'utilisateur", error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer la liste des tâches pour un utilisateur ou pour admin
app.get('/tasks', async (req, res) => {
  const userId = req.query.userId;
  let query = 'SELECT * FROM tasks';
  let params = [];

  if (userId) {
    query = `
      SELECT t.* FROM tasks t
      JOIN user_tasks ut ON t.id = ut.task_id
      WHERE ut.user_id = $1`;
    params = [userId];
  }

  try {
    const result = await pool.query(query, params);
    res.json(Array.isArray(result.rows) ? result.rows : []); // Toujours retourner un tableau
  } catch (error) {
    console.error('Erreur lors de la récupération des tâches', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des tâches' });
  }
});

// Ajouter une nouvelle tâche
app.post('/tasks', async (req, res) => {
  const { name, points, userIds } = req.body;

  if (!name || !points || !userIds || !Array.isArray(userIds)) {
    return res.status(400).json({ error: 'Données de tâche invalides' });
  }

  try {
    const taskResult = await pool.query(
      'INSERT INTO tasks (name, points) VALUES ($1, $2) RETURNING id',
      [name, points]
    );
    const taskId = taskResult.rows[0].id;

    const userTaskPromises = userIds.map(userId =>
      pool.query('INSERT INTO user_tasks (user_id, task_id) VALUES ($1, $2)', [userId, taskId])
    );
    await Promise.all(userTaskPromises);

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la création de la tâche', error);
    res.status(500).json({ error: 'Erreur lors de la création de la tâche' });
  }
});

// Marquer une tâche comme complétée et incrémenter les points de l'utilisateur
app.put('/tasks/:id/complete', async (req, res) => {
  const taskId = req.params.id;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'ID utilisateur manquant' });
  }

  try {
    // Marquer la tâche comme complétée pour l'utilisateur
    await pool.query('UPDATE user_tasks SET completed = true WHERE task_id = $1 AND user_id = $2', [taskId, userId]);

    // Récupérer les points de la tâche
    const pointsResult = await pool.query('SELECT points FROM tasks WHERE id = $1', [taskId]);
    const points = pointsResult.rows[0].points;

    // Incrémenter les points de l'utilisateur
    await pool.query('UPDATE users SET total_points = total_points + $1 WHERE id = $2', [points, userId]);

    res.json({ success: true, points });
  } catch (error) {
    console.error('Erreur lors de la complétion de la tâche', error);
    res.status(500).json({ error: 'Erreur lors de la complétion de la tâche' });
  }
});

app.get('/tasks/:id', async (req, res) => {
  const taskId = req.params.id;
  try {
    const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la récupération de la tâche', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Éditer une tâche
app.put('/tasks/:id/edit', async (req, res) => {
  const taskId = req.params.id;
  const { name, points, userIds } = req.body;

  try {
    await pool.query('UPDATE tasks SET name = $1, points = $2 WHERE id = $3', [name, points, taskId]);

    if (userIds && Array.isArray(userIds)) {
      await pool.query('DELETE FROM user_tasks WHERE task_id = $1', [taskId]);

      const promises = userIds.map(userId =>
        pool.query('INSERT INTO user_tasks (user_id, task_id) VALUES ($1, $2)', [userId, taskId])
      );
      await Promise.all(promises);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la tâche', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la tâche' });
  }
});

// Supprimer une tâche
app.delete('/tasks/:id', async (req, res) => {
  const taskId = req.params.id;

  try {
    await pool.query('DELETE FROM user_tasks WHERE task_id = $1', [taskId]);
    await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression de la tâche', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la tâche' });
  }
});

// Réinitialiser les scores des utilisateurs
app.post('/reset-scores', async (req, res) => {
  console.log('Requête de réinitialisation des scores reçue'); // Confirmer la réception

  try {
    await pool.query('UPDATE users SET total_points = 0');
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la réinitialisation des scores', error);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation des scores' });
  }
});

// Route pour récupérer le leaderboard
app.get('/leaderboard', async (req, res) => {
  try {
      console.log("Début de la requête leaderboard");
      const result = await pool.query(`
          SELECT u.username, u.total_points,
                 array_agg(c.carton_type) AS cartons
          FROM users u
          LEFT JOIN user_cartons uc ON u.id = uc.user_id
          LEFT JOIN cartons c ON uc.carton_type = c.carton_type
          GROUP BY u.username, u.total_points
          ORDER BY u.total_points DESC
      `);
      console.log("Résultat de la requête leaderboard:", result.rows);
      res.json(result.rows);
  } catch (error) {
      console.error('Erreur lors de la récupération du leaderboard:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération du leaderboard' });
  }
});


// Route pour obtenir les cartons attribués à chaque utilisateur
app.get('/user-cartons', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.username, c.carton_type, uc.created_at AS applied_at
      FROM user_cartons uc
      JOIN users u ON uc.user_id = u.id
      JOIN cartons c ON uc.carton_type = c.carton_type
      ORDER BY uc.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des cartons utilisateurs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// Archiver les scores
app.post('/archive-scores', async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO score_archive (username, total_points, archived_at) ' +
      'SELECT username, total_points, NOW() FROM users'
    );
    await pool.query('UPDATE users SET total_points = 0');
    res.json({ success: true });
  } catch (error) {
    console.error("Erreur lors de l'archivage des scores", error);
    res.status(500).json({ error: "Erreur lors de l'archivage des scores" });
  }
});

app.listen(port, () => {
  console.log(`Le serveur est en cours d'exécution sur le port ${port}`);
});

// Route pour appliquer un carton à un utilisateur
app.post('/apply-carton', async (req, res) => {
  const { userId, carton_type, pointsToDeduct } = req.body;

  try {
    await pool.query('INSERT INTO user_cartons (user_id, carton_type) VALUES ($1, $2)', [userId, carton_type]);

    if (pointsToDeduct > 0) {
      await pool.query('UPDATE users SET total_points = total_points - $1 WHERE id = $2', [pointsToDeduct, userId]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Erreur lors de l'application du carton:", error);
    res.status(500).json({ error: "Erreur lors de l'application du carton" });
  }
});

// Route pour réinitialiser tous les cartons
app.post('/reset-cartons', async (req, res) => {
  try {
    await pool.query('DELETE FROM user_cartons');
    res.json({ success: true });
  } catch (error) {
    console.error("Erreur lors de la réinitialisation des cartons:", error);
    res.status(500).json({ error: "Erreur lors de la réinitialisation des cartons" });
  }
});

