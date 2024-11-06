// Tableau des utilisateurs (enfants) avec leurs identifiants
const users = [
    { id: 1, name: 'Eleanore' },
    { id: 2, name: 'Alistair' },
    { id: 3, name: 'Ivanhoe' }
  ];
 
// Vérification de la connexion à la BDD avec indication visuelle
async function checkDatabaseConnection() {
    const statusElement = document.getElementById('dbStatus');
    try {
      const response = await fetch('/test-db');
      const result = await response.json();
      
      if (result.success) {
        statusElement.classList.remove('status-red');
        statusElement.classList.add('status-green');
        console.log("Connexion à la BDD réussie.");
      } else {
        throw new Error("Échec de connexion");
      }
    } catch (error) {
      console.error("Erreur lors de la vérification de la connexion :", error);
      statusElement.classList.add('status-red'); // Affichage de l'erreur
    }
  }
  
  // Appel de la fonction au chargement de la page
  document.addEventListener('DOMContentLoaded', checkDatabaseConnection);
  
// Au clic sur le nom de chaque enfant, on récupère les tâches
document.addEventListener('DOMContentLoaded', () => {
    const userSections = document.querySelectorAll('.user-section h2');
    
    userSections.forEach(section => {
      section.addEventListener('click', () => {
        const list = section.nextElementSibling;
        const userId = section.dataset.userId;
  
        if (!list.classList.contains('open')) {
          fetchTasksForUser(userId); // Charge les tâches si le tiroir s'ouvre
          list.classList.add('open'); 
        } else {
          list.classList.remove('open'); 
        }
      });
    });
  });
  
// Fonction pour charger les tâches d'un utilisateur spécifique sous forme de tableau
// Fonction pour charger et trier les tâches d'un utilisateur spécifique
async function fetchTasksForUser(userId, userName) {
    try {
      const response = await fetch(`/tasks?userId=${userId}`);
      let tasks = await response.json();

      if (!Array.isArray(tasks)) {
        console.error(`Erreur : les tâches reçues pour ${userName || userId} ne sont pas un tableau.`);
        return;
      }

      // Trier les tâches par nom
      tasks = tasks.sort((a, b) => a.name.localeCompare(b.name));

      // Sélection de la liste de tâches dans le DOM
      const taskList = document.getElementById(`tasks-${userName || userId}`);
      if (taskList) {
        taskList.innerHTML = `
          <table class="task-table">
            <tbody>
              ${tasks.map(task => `
                <tr>
                  <td class="task-name">${task.name || 'Nom non défini'}</td>
                  <td class="task-points">${task.points || 0} points</td>
                  <td>
                    <button ${task.completed ? 'disabled' : ''} onclick="completeTask(${task.id}, ${userId})">
                      ${task.completed ? 'Terminée' : 'Compléter'}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    } catch (error) {
      console.error(`Erreur lors de la récupération des tâches pour ${userName || userId}:`, error);
    }
}
 
  // Charger les tâches de chaque utilisateur au chargement de la page
  document.addEventListener('DOMContentLoaded', () => {
    users.forEach(user => {
      fetchTasksForUser(user.id, user.name); // Charger les tâches pour chaque utilisateur
    });
  });

  // Charger et afficher les cartons pour chaque utilisateur
async function fetchCartonsForUser(userId) {
    const response = await fetch(`/user-cartons?userId=${userId}`);
    const cartons = await response.json();
  
    const userSection = document.getElementById(`section-${userId}`);
    userSection.querySelectorAll('.carton').forEach(carton => carton.remove()); // Effacer les cartons actuels
  
    cartons.forEach(couleur => {
      const img = document.createElement('img');
      img.src = `/images/carton_${couleur}.png`;
      img.className = 'carton';
      userSection.appendChild(img);
    });
  }
  
// Fonction pour mettre à jour le podium en fonction des scores
async function updatePodium() {
    try {
      const response = await fetch('/leaderboard');
      const leaderboard = await response.json();
  
      if (!Array.isArray(leaderboard)) {
        throw new Error("Données de leaderboard incorrectes");
      }
  
      const sortedLeaderboard = leaderboard.sort((a, b) => b.total_points - a.total_points);
      const podiumClasses = ['first', 'second', 'third'];
  
      sortedLeaderboard.slice(0, 3).forEach((user, index) => {
        const podiumStep = document.querySelector(`.podium-step.${podiumClasses[index]}`);
        if (podiumStep) {
          const avatar = podiumStep.querySelector('.avatar');
          avatar.src = `images/${user.username.toLowerCase()}.png`;
          avatar.alt = user.username;
  
          const scoreElement = podiumStep.querySelector('.score');
          scoreElement.textContent = `${user.total_points} pts`;
  
          // Affichage des cartons en évitant les `null`
          const cartonContainer = podiumStep.querySelector('.carton-container');
          cartonContainer.innerHTML = (user.cartons || [])
            .filter(carton => carton) // On filtre pour éviter les `null`
            .map(carton => `<img src="images/carton_${carton.toLowerCase()}.png" alt="Carton ${carton}" class="carton-icon">`)
            .join('');
        }
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du podium:', error);
    }
  }
  
// Marquer une tâche comme complétée et mettre à jour les scores
async function completeTask(taskId, userId) {
    try {
      const response = await fetch(`/tasks/${taskId}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
  
      const result = await response.json();
      if (result.success) {
        // Mettre à jour les points et le podium
        updateUserPoints(userId, result.points);
        updatePodium(); // Réactualise l'affichage du podium après l'ajout de points
      } else {
        throw new Error(result.error || 'Erreur inconnue');
      }
    } catch (error) {
      console.error('Erreur lors de la complétion de la tâche:', error);
    }
  }
  
  // Mettre à jour les points de l'utilisateur dans l'interface
  function updateUserPoints(userId, pointsToAdd) {
    const scoreElement = document.getElementById(`score-${getUsernameById(userId)}`);
    if (scoreElement) {
      const currentPoints = parseInt(scoreElement.textContent) || 0;
      scoreElement.textContent = `${currentPoints + pointsToAdd} pts`;
    }
  }
  
  // Obtenir le nom d'utilisateur par ID
  function getUsernameById(userId) {
    switch (userId) {
      case 1: return 'eleanore';
      case 2: return 'alistair';
      case 3: return 'ivanhoe';
      default: return 'user';
    }
  }
  
// Met à jour les scores de chaque utilisateur sur la page et ajuste le podium
async function updateUserScores() {
    try {
      const response = await fetch('/leaderboard');
      const leaderboard = await response.json();
  
      // Mettre à jour les scores individuels sur la page enfant
      leaderboard.forEach(user => {
        const scoreElement = document.getElementById(`score-${user.username.toLowerCase()}`);
        if (scoreElement) {
          scoreElement.textContent = `${user.total_points} pts`;
        }
      });
  
      // Mise à jour du podium en utilisant les mêmes données
      const podiumClasses = ['first', 'second', 'third'];
      leaderboard
        .sort((a, b) => b.total_points - a.total_points)
        .forEach((user, index) => {
          const podiumStep = document.querySelector(`.podium-step.${podiumClasses[index]}`);
          
          if (podiumStep) {
            const avatar = podiumStep.querySelector('.avatar');
            avatar.src = `images/${user.username.toLowerCase()}.png`;
            avatar.alt = user.username;
  
            const scoreElement = podiumStep.querySelector('.score');
            if (scoreElement) {
              scoreElement.textContent = `${user.total_points} pts`;
            }
          }
        });
  
    } catch (error) {
      console.error('Erreur lors de la mise à jour des scores individuels et du podium:', error);
    }
  }
  
  // Appeler le podium à l'affichage initial
  document.addEventListener('DOMContentLoaded', updatePodium);
  
  