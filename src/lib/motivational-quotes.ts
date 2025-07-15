export const quotes = [
  "Keep going, you're doing great!",
  "One step at a time.",
  "You've got this!",
  "Progress, not perfection.",
  "Well done!",
  "Awesome work!",
  "You're on a roll!",
  "Making it happen!",
  "Fantastic effort!",
  "One task closer to your goals.",
  "You are unstoppable!",
  "Great job crossing that off the list."
];

export function getRandomQuote(): string {
  return quotes[Math.floor(Math.random() * quotes.length)];
}
