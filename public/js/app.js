document.addEventListener('DOMContentLoaded', () => {
  loadToday();
  setupTabs();
  setupDishCategoryToggle();
});

function setupTabs() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const tab = document.getElementById(btn.dataset.tab);
      tab.classList.add('active');

      if (btn.dataset.tab === 'weekly') loadWeekly();
      if (btn.dataset.tab === 'dishes') loadDishes();
      if (btn.dataset.tab === 'preferences') loadPreferences();
      if (btn.dataset.tab === 'history') loadHistory();
    });
  });
}

function setupDishCategoryToggle() {
  const category = document.getElementById('dish-category');
  const type = document.getElementById('dish-type');
  category.addEventListener('change', () => {
    type.style.display = category.value === 'nonveg' ? 'block' : 'none';
  });
}

async function loadToday() {
  const res = await fetch('/api/today');
  const data = await res.json();
  document.getElementById('today-menu').textContent = data.message;
}

async function regenerateMenu() {
  const res = await fetch('/api/regenerate', { method: 'POST' });
  const data = await res.json();
  document.getElementById('today-menu').textContent = data.message;
  showToast('New suggestion generated!');
}

async function sendToday() {
  const res = await fetch('/api/send-today', { method: 'POST' });
  const data = await res.json();
  if (data.dryRun) {
    showToast('WhatsApp not configured - message logged to console');
  } else if (data.success) {
    showToast('Sent via WhatsApp!');
  } else {
    showToast('Failed to send: ' + data.error);
  }
}

async function loadWeekly() {
  const res = await fetch('/api/weekly');
  const data = await res.json();
  const container = document.getElementById('weekly-plan');

  let html = '';
  data.plan.forEach(meal => {
    const typeClass = meal.dayType === 'nonveg' ? 'nonveg' : '';
    const emoji = meal.dayType === 'veg' ? '🥬' : '🍗';
    html += `<div class="weekly-day">
      <span class="day-name">${meal.dayName}</span>
      <span class="day-type ${typeClass}">${meal.dayType}</span>
      <span>${emoji} ${meal.dish.name}</span>
    </div>`;
  });

  container.innerHTML = html;
}

async function sendWeekly() {
  const res = await fetch('/api/send-weekly', { method: 'POST' });
  const data = await res.json();
  if (data.dryRun) {
    showToast('WhatsApp not configured - message logged to console');
  } else if (data.success) {
    showToast('Weekly plan sent via WhatsApp!');
  } else {
    showToast('Failed to send: ' + data.error);
  }
}

async function loadDishes() {
  const res = await fetch('/api/dishes');
  const data = await res.json();

  document.getElementById('veg-dishes').innerHTML = data.veg.map(d => dishCard(d)).join('');
  document.getElementById('nonveg-dishes').innerHTML = data.nonveg.map(d => dishCard(d, true)).join('');
}

function dishCard(dish, isNonVeg = false) {
  const dislikes = dish.dislikes.length > 0 ? `<span class="dish-meta">❌ ${dish.dislikes.join(', ')}</span>` : '';
  const type = isNonVeg ? `<span class="dish-meta">[${dish.type}]</span>` : '';
  return `<div class="dish-item">
    <div>
      <span class="dish-name">${dish.name}</span> ${type}
      ${dislikes}
    </div>
    <div class="dish-actions">
      <button class="btn btn-danger" onclick="removeDish('${dish.name.replace(/'/g, "\\'")}')">✕</button>
    </div>
  </div>`;
}

async function addDish(event) {
  event.preventDefault();
  const name = document.getElementById('dish-name').value;
  const category = document.getElementById('dish-category').value;
  const type = document.getElementById('dish-type').value;
  const noVeggies = document.getElementById('no-veggies').checked;
  const likes = [...document.querySelectorAll('input[name="likes"]:checked')].map(c => c.value);
  const allMembers = ['Ramesh', 'Siva', 'Gowthami', 'Sagar'];
  const dislikes = allMembers.filter(m => !likes.includes(m));

  await fetch('/api/dishes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, category, type, likes, dislikes, noVeggiesNeeded: noVeggies })
  });

  document.getElementById('dish-name').value = '';
  loadDishes();
  showToast(`Added "${name}"`);
}

async function removeDish(name) {
  if (!confirm(`Remove "${name}" from the menu?`)) return;
  await fetch(`/api/dishes/${encodeURIComponent(name)}`, { method: 'DELETE' });
  loadDishes();
  showToast(`Removed "${name}"`);
}

async function loadPreferences() {
  const res = await fetch('/api/preferences');
  const data = await res.json();

  let html = '<div class="preferences-section"><h3>Day Types</h3><div class="day-type-grid">';
  Object.entries(data.dayTypes).forEach(([day, type]) => {
    html += `<div class="day-type-item ${type}">${day}: ${type}</div>`;
  });
  html += '</div></div>';

  html += '<div class="preferences-section"><h3>Family Members</h3>';
  data.familyMembers.forEach(m => {
    html += `<div class="dish-item"><span class="dish-name">${m.name} (${m.role})</span>`;
    if (m.restrictions.length) html += `<span class="dish-meta">${m.restrictions.join(', ')}</span>`;
    html += '</div>';
  });
  html += '</div>';

  html += '<div class="preferences-section"><h3>Non-Veg Rules</h3>';
  Object.entries(data.nonvegRules).forEach(([type, rule]) => {
    html += `<div class="dish-item"><span class="dish-name">${type}</span><span class="dish-meta">${rule.frequency} ${rule.times}x</span></div>`;
  });
  html += '</div>';

  html += '<div class="preferences-section"><h3>Add-ons (for when someone doesn\'t eat the dish)</h3>';
  Object.entries(data.addOns).forEach(([person, items]) => {
    html += `<div class="dish-item"><span class="dish-name">${person}</span><span class="dish-meta">${items.join(', ')}</span></div>`;
  });
  html += '</div>';

  document.getElementById('preferences-content').innerHTML = html;
}

async function loadHistory() {
  const res = await fetch('/api/history');
  const data = await res.json();

  if (data.meals.length === 0) {
    document.getElementById('history-content').innerHTML = '<p>No meals recorded yet. Menu will be recorded when sent via WhatsApp or when the daily cron runs.</p>';
    return;
  }

  let html = data.meals.slice().reverse().map(m =>
    `<div class="history-item"><span>${m.date}</span><span>${m.dish}</span><span class="day-type ${m.type === 'nonveg' ? 'nonveg' : ''}">${m.type}</span></div>`
  ).join('');

  document.getElementById('history-content').innerHTML = html;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}
