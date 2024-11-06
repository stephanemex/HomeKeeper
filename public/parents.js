// Vérification que les éléments existent et ajout d'une tâche
const taskForm = document.getElementById('taskForm');
if (taskForm) {
  taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const taskNameInput = document.getElementById('taskName');
    const taskPointsInput = document.getElementById('taskPoints');

    // Vérifier si les champs existent et ont la propriété .value
    const taskName = taskNameInput.value;
    const taskPoints = parseInt(taskPointsInput.value);
    const userIds = Array.from(document.querySelectorAll('input[name="user"]:checked'))
      .map(input => input.value);

    await fetch('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: taskName, points: taskPoints, userIds }),
    });
    displayAdminTasks();
  });
}

// Fonction pour éditer une tâche
async function editTask(taskId) {
  try {
    // Vérifier que taskId est bien défini
    if (!taskId) throw new Error("ID de tâche non spécifié pour l'édition.");

    // Récupérer les informations de la tâche à éditer
    const response = await fetch(`/tasks/${taskId}`);
    if (!response.ok) throw new Error("Erreur lors du chargement de la tâche.");
    
    const task = await response.json();
    
    // Pré-remplir les champs du formulaire d'édition
    document.getElementById('taskName').value = task.name;
    document.getElementById('taskPoints').value = task.points;

    // Gestion de la soumission du formulaire d'édition
    document.getElementById('taskForm').onsubmit = async (e) => {
      e.preventDefault();

      const newName = document.getElementById('taskName').value;
      const newPoints = parseInt(document.getElementById('taskPoints').value, 10);

      const editResponse = await fetch(`/tasks/${taskId}/edit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, points: newPoints }),
      });

      if (!editResponse.ok) throw new Error("Erreur lors de l'édition de la tâche.");

      // Réactualiser la liste des tâches après édition
      displayAdminTasks();
    };
  } catch (error) {
    console.error('Erreur lors de la récupération de la tâche pour édition:', error);
  }
}

// Fonction pour afficher et trier les tâches en admin sous forme de tableau
async function displayAdminTasks() {
  const response = await fetch('/tasks');
  let tasks = await response.json();

  if (!Array.isArray(tasks)) {
    console.error("Erreur : les tâches reçues ne sont pas un tableau.");
    return;
  }

  // Trier les tâches par nom
  tasks = tasks.sort((a, b) => a.name.localeCompare(b.name));

  const taskList = document.getElementById('adminTaskList');
  if (taskList) {
    taskList.innerHTML = `
      <table class="task-table">
        <thead>
          <tr>
            <th>Tâche</th>
            <th>Éditer</th>
            <th>Supprimer</th>
          </tr>
        </thead>
        <tbody>
          ${tasks.map(task => `
            <tr>
              <td>${task.name} - ${task.points} points</td>
              <td><button onclick="editTask(${task.id})">Éditer</button></td>
              <td><button onclick="deleteTask(${task.id})">Supprimer</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
}

// Gestion du tiroir pour la liste des tâches
document.addEventListener('DOMContentLoaded', () => {
  const taskListHeader = document.getElementById('taskListHeader');
  const adminTaskListContainer = document.getElementById('adminTaskListContainer');

  // Cache la liste au démarrage
  adminTaskListContainer.style.display = 'none';

  taskListHeader.addEventListener('click', () => {
    // Affiche ou masque le tiroir de manière dynamique
    adminTaskListContainer.style.display = adminTaskListContainer.style.display === 'none' ? 'block' : 'none';
  });

  // Charge la liste des tâches
  displayAdminTasks();
});

// Supprimer une tâche
async function deleteTask(taskId) {
  await fetch(`/tasks/${taskId}`, { method: 'DELETE' });
  displayAdminTasks();
}

// Fonction pour réinitialiser les scores
const resetScoresButton = document.getElementById('resetScores');
if (resetScoresButton) {
  console.log("Bouton trouvé, ajout de l'événement...");
  resetScoresButton.addEventListener('click', async () => {
    console.log('Bouton de réinitialisation cliqué');
    try {
      const response = await fetch('/reset-scores', { method: 'POST' });
      if (response.ok) {
        alert('Scores réinitialisés !');
        fetchLeaderboard(); // Rafraîchit le leaderboard
      } else {
        console.error('Erreur lors de la réinitialisation des scores');
      }
    } catch (error) {
      console.error('Erreur lors de la requête de réinitialisation:', error);
    }
  });
} else {
  console.error("Bouton de réinitialisation introuvable");
}

// Affichage du leaderboard sous forme de bargraph avec cartons
async function fetchLeaderboard() {
  try {
    const response = await fetch('/leaderboard');
    const leaderboard = await response.json();

    if (!Array.isArray(leaderboard)) {
      throw new Error("Données de leaderboard incorrectes");
    }

    const leaderboardElement = document.getElementById('scoreArchive');
    if (leaderboardElement) {
      leaderboardElement.innerHTML = leaderboard.map(user => {
        const scoreWidth = Math.max(4, user.total_points * 4); 
        const cartons = user.cartons || []; 

        return `
          <div class="bar">
            <div class="bar-label">${user.username}</div>
            <div class="bar-fill ${user.username.toLowerCase()}" data-points="${user.total_points}" style="width: ${scoreWidth}px;"></div>
            <div class="bar-score">${user.total_points} pts</div>
            <div class="carton-icons">
              ${cartons
                .filter(carton => carton) // Ignore `null`
                .map(carton => `<img src="images/carton_${carton.toLowerCase()}.png" alt="Carton ${carton}" class="carton-icon">`)
                .join('')}
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (error) {
    console.error('Erreur lors du chargement du leaderboard:', error);
  }
}

// Fonction pour assigner un carton jaune
async function assignCartonJaune() {
  await assignCarton("Jaune", 0); // Aucun point déduit
}

// Fonction pour assigner un carton orange
async function assignCartonOrange() {
  await assignCarton("Orange", 3); // 3 points déduits
}

// Fonction pour assigner un carton rouge
async function assignCartonRouge() {
  await assignCarton("Rouge", 6); // 6 points déduits
}

// Fonction générique d'assignation de carton
async function assignCarton(carton_type, pointsToDeduct) {
  const users = Array.from(document.querySelectorAll('input[name="user"]:checked')).map(input => input.value);
  if (users.length === 0) {
    alert("Sélectionnez au moins un utilisateur.");
    return;
  }

  for (const userId of users) {
    try {
      const response = await fetch('/apply-carton', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, carton_type, pointsToDeduct }) // On envoie carton_type et pointsToDeduct
      });

      if (!response.ok) {
        const errorMsg = await response.text();
        console.error("Erreur lors de l'application du carton:", errorMsg);
        alert("Échec de l'application du carton.");
      } else {
        console.log(`Carton ${carton_type} appliqué avec succès à l'utilisateur ID: ${userId}`);
      }

    } catch (error) {
      console.error("Erreur lors de la requête d'application du carton:", error);
      alert("Une erreur s'est produite lors de l'application du carton.");
    }
  }

  // Rafraîchit l'affichage des scores et du podium
  fetchLeaderboard();
  updateUserScores();
  updatePodium();
}


// Assurez-vous d'inclure également l'appel `fetchCartonSummary()` si besoin pour recharger les cartons dans l'interface admin
document.addEventListener('DOMContentLoaded', () => {
  fetchCartonSummary();
});



  // Fonction pour mettre à jour les scores et le podium
  async function updateUserScores() {
    try {
        const response = await fetch('/leaderboard');
        const leaderboard = await response.json();
        console.log("Données de leaderboard pour mise à jour des scores:", leaderboard);

        if (!Array.isArray(leaderboard)) {
          throw new Error("Données de leaderboard incorrectes");
        }

        leaderboard.forEach(user => {
            const scoreElement = document.getElementById(`score-${user.username.toLowerCase()}`);
            if (scoreElement) {
                scoreElement.textContent = `${user.total_points} pts`;
            }
        });

        updatePodium();
    } catch (error) {
        console.error('Erreur lors de la mise à jour des scores:', error);
    }
  }
    // Mettre à jour le leaderboard et le podium après l'application du carton
    fetchLeaderboard();
    updateUserScores();

    // Fonction pour mettre à jour le podium en fonction des scores
    async function updatePodium() {
      try {
        const response = await fetch('/leaderboard');
        const leaderboard = await response.json();
        console.log("Données du podium:", leaderboard);

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
    
            const cartonContainer = podiumStep.querySelector('.carton-container');
            cartonContainer.innerHTML = (user.cartons || []).map(carton =>
              `<img src="images/carton_${carton}.png" alt="Carton ${carton}" class="carton-icon">`
            ).join('');
          }
        });
      } catch (error) {
        console.error('Erreur lors de la mise à jour du podium:', error);
      }
    }
    
    // Fonction pour charger et afficher les cartons par utilisateur
    async function fetchCartonSummary() {
      try {
        const response = await fetch('/user-cartons'); // Assurez-vous que la route est bien configurée dans server.js
        const userCartons = await response.json();
        const cartonSummary = document.getElementById('cartonSummary');

        if (cartonSummary) {
          cartonSummary.innerHTML = userCartons.map(entry => `
            <div class="carton-entry">
              <span>${entry.username}</span> - 
              <img src="images/carton_${entry.carton_type.toLowerCase()}.png" alt="${entry.carton_type}" class="carton-icon">
              <span>${entry.carton_type}</span>
              <span>Appliqué le: ${new Date(entry.applied_at).toLocaleDateString()}</span>
            </div>
          `).join('');
        }
      } catch (error) {
        console.error('Erreur lors du chargement du récapitulatif des cartons:', error);
      }
    }

    // Chargez le récapitulatif des cartons au chargement de la page admin
    document.addEventListener('DOMContentLoaded', fetchCartonSummary);

    // Fonction pour réinitialiser tous les cartons
    async function resetAllCartons() {
      try {
        const response = await fetch('/reset-cartons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          alert("Tous les cartons ont été réinitialisés !");
          fetchLeaderboard();  // Met à jour l'affichage après réinitialisation
        } else {
          console.error("Erreur lors de la réinitialisation des cartons.");
        }
      } catch (error) {
        console.error("Erreur lors de la requête de réinitialisation des cartons:", error);
      }
    }

  // Mettre à jour le podium et le leaderboard
  updateUserScores();
  fetchLeaderboard();

// Charger le leaderboard au démarrage
fetchLeaderboard();

// Appeler displayAdminTasks pour afficher les tâches actuelles dès le chargement
displayAdminTasks();