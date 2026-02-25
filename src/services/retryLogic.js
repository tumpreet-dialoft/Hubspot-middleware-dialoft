const ATTEMPT_DELAYS = [0, 1, 3, 6, 12, 20, 28]; 

module.exports = {
  calculateNextTime(currentAttempt) {
    if (currentAttempt >= ATTEMPT_DELAYS.length) return null;
    
    const hours = ATTEMPT_DELAYS[currentAttempt];
    const nextDate = new Date();
    nextDate.setHours(nextDate.getHours() + hours);
    return nextDate.toISOString();
  },
  
  isHardStop(sentiment) {
    const stops = ['Interested', 'Not Interested'];
    return stops.includes(sentiment);
  }
};