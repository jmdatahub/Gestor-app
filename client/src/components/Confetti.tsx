import { useEffect, useState } from 'react'

interface ConfettiPiece {
  id: number
  x: number
  color: string
  delay: number
  rotation: number
}

interface ConfettiProps {
  trigger: boolean
  onComplete?: () => void
}

const CONFETTI_COLORS = [
  '#10b981', // success green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
]

export function Confetti({ trigger, onComplete }: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    if (trigger && !isActive) {
      setIsActive(true)
      
      // Generate confetti pieces
      const newPieces: ConfettiPiece[] = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        delay: Math.random() * 0.3,
        rotation: Math.random() * 360
      }))
      
      setPieces(newPieces)
      
      // Clear after animation
      setTimeout(() => {
        setPieces([])
        setIsActive(false)
        onComplete?.()
      }, 2500)
    }
  }, [trigger, isActive, onComplete])

  if (pieces.length === 0) return null

  return (
    <>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 99999,
        overflow: 'hidden'
      }}>
        {pieces.map(piece => (
          <div
            key={piece.id}
            style={{
              position: 'absolute',
              left: `${piece.x}%`,
              top: '-10px',
              width: '10px',
              height: '10px',
              backgroundColor: piece.color,
              borderRadius: piece.id % 3 === 0 ? '50%' : piece.id % 3 === 1 ? '2px' : '0',
              transform: `rotate(${piece.rotation}deg)`,
              animation: `confetti-fall 2s ease-out ${piece.delay}s forwards`,
              opacity: 0
            }}
          />
        ))}
      </div>
      
      <style>{`
        @keyframes confetti-fall {
          0% {
            opacity: 1;
            transform: translateY(0) rotate(0deg) scale(1);
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(100vh) rotate(720deg) scale(0.5);
          }
        }
      `}</style>
    </>
  )
}

// Hook for easy confetti triggering
export function useConfetti() {
  const [trigger, setTrigger] = useState(false)
  
  const fire = () => {
    setTrigger(true)
  }
  
  const reset = () => {
    setTrigger(false)
  }
  
  return { trigger, fire, reset, Confetti }
}

export default Confetti
