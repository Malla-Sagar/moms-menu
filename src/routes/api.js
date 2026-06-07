const express = require('express');
const router = express.Router();
const { generateMeal, recordMeal, formatMealMessage, formatWeeklyPlan, generateWeeklyPlan, getAlternativeDish, loadJSON, saveJSON } = require('../services/menuGenerator');
const { sendMessage, parseIncomingMessage, getHelpMessage } = require('../services/whatsapp');
const { getTodaysMeal, setTodaysMeal } = require('../services/scheduler');

// Get today's menu
router.get('/today', (req, res) => {
  const meal = getTodaysMeal();
  res.json({ meal, message: formatMealMessage(meal) });
});

// Generate a new suggestion for today
router.post('/regenerate', (req, res) => {
  const meal = generateMeal(new Date());
  setTodaysMeal(meal);
  res.json({ meal, message: formatMealMessage(meal) });
});

// Get next week's plan
router.get('/weekly', (req, res) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const plan = generateWeeklyPlan(tomorrow);
  res.json({ plan, message: formatWeeklyPlan(plan) });
});

// Send today's menu via WhatsApp
router.post('/send-today', async (req, res) => {
  const meal = getTodaysMeal();
  const message = formatMealMessage(meal);
  const result = await sendMessage(message);
  recordMeal(meal);
  res.json(result);
});

// Send weekly plan via WhatsApp
router.post('/send-weekly', async (req, res) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const plan = generateWeeklyPlan(tomorrow);
  const message = formatWeeklyPlan(plan);
  const result = await sendMessage(message);
  res.json(result);
});

// Get all dishes
router.get('/dishes', (req, res) => {
  const dishes = loadJSON('dishes.json');
  res.json(dishes);
});

// Add a dish
router.post('/dishes', (req, res) => {
  const { name, type, category, likes, dislikes, comments } = req.body;
  const dishes = loadJSON('dishes.json');

  const dish = { name, likes: likes || [], dislikes: dislikes || [], comments: comments || '' };

  if (category === 'nonveg') {
    dish.type = type || 'egg';
    dishes.nonveg.push(dish);
  } else {
    dish.noVeggiesNeeded = req.body.noVeggiesNeeded || false;
    dishes.veg.push(dish);
  }

  saveJSON('dishes.json', dishes);
  res.json({ success: true, dish });
});

// Remove a dish
router.delete('/dishes/:name', (req, res) => {
  const dishes = loadJSON('dishes.json');
  const name = decodeURIComponent(req.params.name);

  dishes.veg = dishes.veg.filter(d => d.name !== name);
  dishes.nonveg = dishes.nonveg.filter(d => d.name !== name);

  saveJSON('dishes.json', dishes);
  res.json({ success: true });
});

// Update a dish
router.put('/dishes/:name', (req, res) => {
  const dishes = loadJSON('dishes.json');
  const name = decodeURIComponent(req.params.name);
  const updates = req.body;

  let found = false;
  for (const list of [dishes.veg, dishes.nonveg]) {
    const idx = list.findIndex(d => d.name === name);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      found = true;
      break;
    }
  }

  if (!found) return res.status(404).json({ error: 'Dish not found' });
  saveJSON('dishes.json', dishes);
  res.json({ success: true });
});

// Get preferences
router.get('/preferences', (req, res) => {
  const preferences = loadJSON('preferences.json');
  res.json(preferences);
});

// Update preferences
router.put('/preferences', (req, res) => {
  const preferences = loadJSON('preferences.json');
  Object.assign(preferences, req.body);
  saveJSON('preferences.json', preferences);
  res.json({ success: true, preferences });
});

// Get history
router.get('/history', (req, res) => {
  const history = loadJSON('history.json');
  res.json(history);
});

// Twilio webhook for incoming WhatsApp messages
router.post('/webhook/whatsapp', async (req, res) => {
  const incomingMsg = req.body.Body || '';
  const parsed = parseIncomingMessage(incomingMsg);
  let reply = '';

  switch (parsed.command) {
    case 'todayMenu': {
      const meal = getTodaysMeal();
      reply = formatMealMessage(meal);
      break;
    }
    case 'alternative': {
      const current = getTodaysMeal();
      const alt = getAlternativeDish(current.dish.name, parsed.noVeggies);
      const newMeal = { ...current, dish: alt, addOns: [] };
      setTodaysMeal(newMeal);
      reply = `Here's an alternative:\n\n${formatMealMessage(newMeal)}`;
      break;
    }
    case 'weeklyPlan': {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const plan = generateWeeklyPlan(tomorrow);
      reply = formatWeeklyPlan(plan);
      break;
    }
    case 'addDish': {
      if (parsed.details) {
        const dishes = loadJSON('dishes.json');
        dishes.veg.push({
          name: parsed.details,
          likes: ['Ramesh', 'Siva', 'Gowthami'],
          dislikes: [],
          noVeggiesNeeded: false,
          comments: 'Added via WhatsApp'
        });
        saveJSON('dishes.json', dishes);
        reply = `Added "${parsed.details}" to veg dishes. Edit preferences on the web panel for more options.`;
      } else {
        reply = 'Usage: add dish [dish name]';
      }
      break;
    }
    case 'removeDish': {
      if (parsed.details) {
        const dishes = loadJSON('dishes.json');
        const before = dishes.veg.length + dishes.nonveg.length;
        dishes.veg = dishes.veg.filter(d => d.name.toLowerCase() !== parsed.details.toLowerCase());
        dishes.nonveg = dishes.nonveg.filter(d => d.name.toLowerCase() !== parsed.details.toLowerCase());
        const after = dishes.veg.length + dishes.nonveg.length;
        if (before !== after) {
          saveJSON('dishes.json', dishes);
          reply = `Removed "${parsed.details}" from the menu.`;
        } else {
          reply = `Couldn't find "${parsed.details}" in the menu.`;
        }
      } else {
        reply = 'Usage: remove dish [dish name]';
      }
      break;
    }
    case 'help':
      reply = getHelpMessage();
      break;
    default:
      reply = `I didn't understand that. ${getHelpMessage()}`;
  }

  await sendMessage(reply);
  res.set('Content-Type', 'text/xml');
  res.send('<Response></Response>');
});

module.exports = router;
