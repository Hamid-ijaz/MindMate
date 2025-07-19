"use client";

import { useCallback, useRef } from 'react';

export function useCompletionAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playCompletionSound = useCallback(() => {
    try {
      // Create audio element if it doesn't exist
      if (!audioRef.current) {
        audioRef.current = new Audio('/audio/complete-tone.wav');
        audioRef.current.preload = 'auto';
      }

      // Play the sound
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(error => {
        console.warn('Failed to play completion sound:', error);
      });
    } catch (error) {
      console.warn('Error playing completion sound:', error);
    }
  }, []);

  const triggerCelebration = useCallback((buttonElement: HTMLElement | null) => {
    // Create a full-screen celebration effect
    const celebration = document.createElement('div');
    celebration.style.position = 'fixed';
    celebration.style.top = '0';
    celebration.style.left = '0';
    celebration.style.width = '100vw';
    celebration.style.height = '100vh';
    celebration.style.pointerEvents = 'none';
    celebration.style.zIndex = '9999';
    celebration.style.overflow = 'hidden';
    
    // Animate the button if available
    if (buttonElement) {
      try {
        buttonElement.classList.add('animate-bounce', 'scale-110');
        buttonElement.style.backgroundColor = '#10b981';
        buttonElement.style.color = 'white';
        buttonElement.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.5)';
        buttonElement.style.transition = 'all 0.3s ease';
        
        setTimeout(() => {
          if (buttonElement && buttonElement.parentNode) {
            buttonElement.classList.remove('animate-bounce', 'scale-110');
            buttonElement.style.backgroundColor = '';
            buttonElement.style.color = '';
            buttonElement.style.boxShadow = '';
            buttonElement.style.transition = '';
          }
        }, 1000);
      } catch (error) {
        console.log('Button animation failed, continuing with celebration');
      }
    }

    // Add celebration CSS if not already present
    if (!document.querySelector('#celebration-animations')) {
      const style = document.createElement('style');
      style.id = 'celebration-animations';
      style.textContent = `
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        @keyframes sparkle {
          0% {
            transform: scale(0) rotate(0deg);
            opacity: 1;
          }
          50% {
            transform: scale(1) rotate(180deg);
            opacity: 1;
          }
          100% {
            transform: scale(0) rotate(360deg);
            opacity: 0;
          }
        }
        @keyframes particle-blow {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--blow-x), var(--blow-y)) scale(0);
            opacity: 0;
          }
        }
        @keyframes confetti-fall {
          0% {
            transform: translateY(-100px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        @keyframes bomb-explosion {
          0% {
            transform: scale(0) translate(var(--start-x), var(--start-y));
            opacity: 1;
          }
          50% {
            transform: scale(1.2) translate(var(--mid-x), var(--mid-y));
            opacity: 1;
          }
          100% {
            transform: scale(0) translate(var(--end-x), var(--end-y));
            opacity: 0;
          }
        }
        @keyframes sparkle-trail {
          0% {
            transform: translate(var(--start-x), var(--start-y)) scale(0);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translate(var(--end-x), var(--end-y)) scale(1);
            opacity: 0;
          }
        }
        @keyframes particle-burst {
          0% {
            transform: translate(var(--start-x), var(--start-y)) scale(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
            transform: translate(var(--start-x), var(--start-y)) scale(1);
          }
          100% {
            transform: translate(var(--end-x), var(--end-y)) scale(0);
            opacity: 0;
          }
        }
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(16, 185, 129, 0.5);
          }
          50% {
            box-shadow: 0 0 40px rgba(16, 185, 129, 0.8);
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Get screen dimensions for responsive design
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const isMobile = screenWidth < 768;
    
    // Create bomb explosion effects from bottom corners
    const createBombEffect = (startX: number, startY: number, endX: number, endY: number, delay: string) => {
      const bomb = document.createElement('div');
      bomb.style.position = 'absolute';
      bomb.style.left = startX + 'px';
      bomb.style.top = startY + 'px';
      bomb.style.width = '20px';
      bomb.style.height = '20px';
      bomb.style.backgroundColor = '#fbbf24';
      bomb.style.borderRadius = '50%';
      bomb.style.setProperty('--start-x', '0px');
      bomb.style.setProperty('--start-y', '0px');
      bomb.style.setProperty('--mid-x', ((endX - startX) * 0.5) + 'px');
      bomb.style.setProperty('--mid-y', ((endY - startY) * 0.5) + 'px');
      bomb.style.setProperty('--end-x', (endX - startX) + 'px');
      bomb.style.setProperty('--end-y', (endY - startY) + 'px');
      bomb.style.animation = `bomb-explosion 1.5s ease-out ${delay}`;
      return bomb;
    };
    
    // Create sparkle trail effects
    const createSparkleTrail = (startX: number, startY: number, endX: number, endY: number, size: string, delay: string) => {
      const sparkle = document.createElement('div');
      sparkle.style.position = 'absolute';
      sparkle.style.left = startX + 'px';
      sparkle.style.top = startY + 'px';
      sparkle.style.width = size;
      sparkle.style.height = size;
      sparkle.style.backgroundColor = '#fbbf24';
      sparkle.style.borderRadius = '50%';
      sparkle.style.setProperty('--start-x', '0px');
      sparkle.style.setProperty('--start-y', '0px');
      sparkle.style.setProperty('--end-x', (endX - startX) + 'px');
      sparkle.style.setProperty('--end-y', (endY - startY) + 'px');
      sparkle.style.animation = `sparkle-trail 2s ease-out ${delay}`;
      return sparkle;
    };
    
    // Create particle burst effects
    const createParticleBurst = (startX: number, startY: number, endX: number, endY: number, color: string, size: string, delay: string) => {
      const particle = document.createElement('div');
      particle.style.position = 'absolute';
      particle.style.left = startX + 'px';
      particle.style.top = startY + 'px';
      particle.style.width = size;
      particle.style.height = size;
      particle.style.backgroundColor = color;
      particle.style.borderRadius = '50%';
      particle.style.setProperty('--start-x', '0px');
      particle.style.setProperty('--start-y', '0px');
      particle.style.setProperty('--end-x', (endX - startX) + 'px');
      particle.style.setProperty('--end-y', (endY - startY) + 'px');
      particle.style.animation = `particle-burst 1.8s ease-out ${delay}`;
      return particle;
    };
    
    // Create confetti pieces
    const createConfetti = (left: string, color: string, delay: string) => {
      const confetti = document.createElement('div');
      confetti.style.position = 'absolute';
      confetti.style.left = left;
      confetti.style.top = '-20px';
      confetti.style.width = '6px';
      confetti.style.height = '12px';
      confetti.style.backgroundColor = color;
      confetti.style.animation = `confetti-fall 2s ease-in ${delay}`;
      return confetti;
    };
    
    // Colors for the celebration
    const colors = ['#fbbf24', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];
    
    // Create bomb effects from bottom corners
    const cornerPositions = [
      { x: 0, y: screenHeight }, // Bottom left
      { x: screenWidth, y: screenHeight }, // Bottom right
      { x: screenWidth * 0.25, y: screenHeight }, // Bottom quarter
      { x: screenWidth * 0.75, y: screenHeight }, // Bottom three-quarter
    ];
    
    // Add bomb explosions from corners
    cornerPositions.forEach((corner, index) => {
      // Main bomb explosion
      const targetX = screenWidth * (0.2 + (index * 0.2));
      const targetY = screenHeight * 0.3;
      celebration.appendChild(createBombEffect(corner.x, corner.y, targetX, targetY, (index * 0.1) + 's'));
      
      // Sparkle trails from each corner
      for (let i = 0; i < (isMobile ? 6 : 8); i++) {
        const angle = (i / (isMobile ? 6 : 8)) * Math.PI * 0.5; // Spread across 90 degrees
        const distance = 100 + Math.random() * 200;
        const endX = corner.x + Math.cos(angle) * distance;
        const endY = corner.y - Math.sin(angle) * distance;
        const size = (4 + Math.random() * 8) + 'px';
        const delay = (index * 0.1 + i * 0.05) + 's';
        
        celebration.appendChild(createSparkleTrail(corner.x, corner.y, endX, endY, size, delay));
      }
      
      // Particle bursts from each corner
      for (let i = 0; i < (isMobile ? 4 : 6); i++) {
        const angle = (i / (isMobile ? 4 : 6)) * Math.PI * 0.5;
        const distance = 150 + Math.random() * 250;
        const endX = corner.x + Math.cos(angle) * distance;
        const endY = corner.y - Math.sin(angle) * distance;
        const color = colors[i % colors.length];
        const size = (3 + Math.random() * 6) + 'px';
        const delay = (index * 0.1 + i * 0.08) + 's';
        
        celebration.appendChild(createParticleBurst(corner.x, corner.y, endX, endY, color, size, delay));
      }
    });
    
    // Add confetti falling from top
    for (let i = 0; i < (isMobile ? 8 : 12); i++) {
      const left = (i * (100 / (isMobile ? 8 : 12))) + '%';
      const color = colors[i % colors.length];
      const delay = (Math.random() * 0.5) + 's';
      
      celebration.appendChild(createConfetti(left, color, delay));
    }
    
    // Add the celebration to the document body instead of the button
    document.body.appendChild(celebration);

    // Remove celebration after animation completes
    setTimeout(() => {
      if (celebration.parentNode) {
        celebration.parentNode.removeChild(celebration);
      }
    }, 2000); // 2 seconds for the full celebration
  }, []);

  const handleTaskCompletion = useCallback((buttonElement: HTMLElement | null) => {
    console.log('Task completion triggered', { buttonElement: !!buttonElement });
    playCompletionSound();
    triggerCelebration(buttonElement);
  }, [playCompletionSound, triggerCelebration]);

  return { handleTaskCompletion };
} 