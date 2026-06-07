const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function loadJSON(filename) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf-8'));
}

function saveJSON(filename, data) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2));
}

function getDayType(dayName) {
  const preferences = loadJSON('preferences.json');
  return preferences.dayTypes[dayName] || 'veg';
}

function getRecentDishes(days = 7) {
  const history = loadJSON('history.json');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return history.meals.filter(m => new Date(m.date) >= cutoff).map(m => m.dish);
}

function pickWeightedRandom(dishes, recentDishes) {
  const available = dishes.filter(d => !recentDishes.includes(d.name));
  if (available.length === 0) return dishes[Math.floor(Math.random() * dishes.length)];

  const universallyLiked = available.filter(d => d.dislikes.length === 0);
  const partial = available.filter(d => d.dislikes.length > 0);

  const weighted = [
    ...universallyLiked.map(d => ({ dish: d, weight: 3 })),
    ...partial.map(d => ({ dish: d, weight: 1 }))
  ];

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of weighted) {
    random -= item.weight;
    if (random <= 0) return item.dish;
  }
  return weighted[weighted.length - 1].dish;
}

function shouldSuggestSpecialDish() {
  const history = loadJSON('history.json');
  if (!history.lastSpecialDishDate) return true;
  const daysSince = Math.floor((Date.now() - new Date(history.lastSpecialDishDate)) / 86400000);
  return daysSince >= 7;
}

function selectNonVegDish() {
  const history = loadJSON('history.json');
  const dishes = loadJSON('dishes.json');
  const recentDishes = getRecentDishes(14);

  const now = new Date();
  const daysSinceChicken = history.lastChickenDate
    ? Math.floor((now - new Date(history.lastChickenDate)) / 86400000)
    : 999;
  const fishThisWeek = history.lastFishDates.filter(d => {
    const diff = Math.floor((now - new Date(d)) / 86400000);
    return diff < 7;
  }).length;
  const daysSinceEgg = history.lastEggDate
    ? Math.floor((now - new Date(history.lastEggDate)) / 86400000)
    : 999;

  let pool;
  if (daysSinceChicken >= 14) {
    pool = dishes.nonveg.filter(d => d.type === 'chicken');
  } else if (fishThisWeek < 2) {
    pool = dishes.nonveg.filter(d => d.type === 'fish');
  } else if (daysSinceEgg >= 7) {
    pool = dishes.nonveg.filter(d => d.type === 'egg');
  } else {
    pool = dishes.nonveg.filter(d => d.type === 'fish' || d.type === 'egg');
  }

  if (pool.length === 0) pool = dishes.nonveg;
  return pickWeightedRandom(pool, recentDishes);
}

function generateMeal(date) {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const dayType = getDayType(dayName);
  const dishes = loadJSON('dishes.json');
  const preferences = loadJSON('preferences.json');
  const recentDishes = getRecentDishes(5);

  let dish;
  let addOns = [];

  if (dayType === 'veg') {
    const useSpecial = shouldSuggestSpecialDish();
    let pool;
    if (useSpecial) {
      pool = dishes.veg.filter(d => d.dislikes.length > 0);
      if (pool.length === 0) pool = dishes.veg;
    } else {
      pool = dishes.veg;
    }
    dish = pickWeightedRandom(pool, recentDishes);

    if (dish.dislikes.length > 0) {
      dish.dislikes.forEach(person => {
        if (preferences.addOns[person]) {
          const addon = preferences.addOns[person][Math.floor(Math.random() * preferences.addOns[person].length)];
          addOns.push({ person, addon });
        }
      });
    }
  } else {
    dish = selectNonVegDish();
    if (dish.type !== 'egg') {
      addOns.push({ person: 'Aruna', addon: 'Egg (she eats only eggs from non-veg)' });
    }
    if (dish.dislikes.length > 0) {
      dish.dislikes.forEach(person => {
        if (preferences.addOns[person]) {
          const addon = preferences.addOns[person][Math.floor(Math.random() * preferences.addOns[person].length)];
          addOns.push({ person, addon });
        }
      });
    }
  }

  return { date: date.toISOString().split('T')[0], dayName, dayType, dish, addOns };
}

function recordMeal(meal) {
  const history = loadJSON('history.json');
  history.meals.push({ date: meal.date, dish: meal.dish.name, type: meal.dayType });

  if (meal.dayType === 'nonveg') {
    if (meal.dish.type === 'chicken') history.lastChickenDate = meal.date;
    if (meal.dish.type === 'fish') {
      history.lastFishDates.push(meal.date);
      history.lastFishDates = history.lastFishDates.slice(-5);
    }
    if (meal.dish.type === 'egg') history.lastEggDate = meal.date;
  }

  if (meal.dish.dislikes && meal.dish.dislikes.length > 0) {
    history.lastSpecialDishDate = meal.date;
  }

  if (history.meals.length > 60) history.meals = history.meals.slice(-60);
  saveJSON('history.json', history);
}

function generateWeeklyPlan(startDate) {
  const plan = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    plan.push(generateMeal(date));
  }
  return plan;
}

function formatMealMessage(meal) {
  let msg = `*${meal.dayName} Menu (${meal.date})*\n\n`;
  msg += `${meal.dayType === 'veg' ? '🥬' : '🍗'} *${meal.dish.name}*\n`;

  if (meal.dish.comments) {
    msg += `📝 ${meal.dish.comments}\n`;
  }

  if (meal.addOns.length > 0) {
    msg += `\n*Add-ons:*\n`;
    meal.addOns.forEach(a => {
      msg += `  • ${a.person}: ${a.addon}\n`;
    });
  }

  const allLike = meal.dish.likes || [];
  if (allLike.length > 0) {
    msg += `\n👨‍👩‍👧‍👦 Everyone who eats: ${allLike.join(', ')}`;
  }

  return msg;
}

function formatWeeklyPlan(plan) {
  let msg = `*📋 Next Week's Menu Plan*\n${'─'.repeat(25)}\n\n`;
  const veggiesNeeded = new Set();

  plan.forEach(meal => {
    const emoji = meal.dayType === 'veg' ? '🥬' : '🍗';
    msg += `*${meal.dayName}*: ${emoji} ${meal.dish.name}\n`;
    if (!meal.dish.noVeggiesNeeded && meal.dayType === 'veg') {
      veggiesNeeded.add(meal.dish.name);
    }
  });

  msg += `\n${'─'.repeat(25)}\n`;
  msg += `*🛒 Veggies needed for:*\n`;
  veggiesNeeded.forEach(dish => {
    msg += `  • ${dish}\n`;
  });

  return msg;
}

function getAlternativeDish(currentDish, noVeggies = false) {
  const dishes = loadJSON('dishes.json');
  const recentDishes = getRecentDishes(3);

  let pool;
  if (noVeggies) {
    pool = dishes.veg.filter(d => d.noVeggiesNeeded && d.name !== currentDish);
  } else {
    pool = [...dishes.veg, ...dishes.nonveg].filter(d => d.name !== currentDish);
  }

  if (pool.length === 0) pool = dishes.veg.filter(d => d.name !== currentDish);
  return pickWeightedRandom(pool, recentDishes);
}

module.exports = {
  generateMeal,
  recordMeal,
  generateWeeklyPlan,
  formatMealMessage,
  formatWeeklyPlan,
  getAlternativeDish,
  loadJSON,
  saveJSON
};
