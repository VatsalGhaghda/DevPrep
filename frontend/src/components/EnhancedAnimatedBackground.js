import { motion } from 'framer-motion';
import { Code, Database, Terminal, Cpu, Layers, GitBranch, Box, Zap } from 'lucide-react';

const FloatingIcons = () => {
  const icons = [
    { Icon: Code, x: '10%', y: '20%', delay: 0, duration: 8 },
    { Icon: Database, x: '85%', y: '15%', delay: 1, duration: 10 },
    { Icon: Terminal, x: '15%', y: '75%', delay: 0.5, duration: 9 },
    { Icon: Cpu, x: '80%', y: '70%', delay: 1.5, duration: 7 },
    { Icon: Layers, x: '25%', y: '45%', delay: 2, duration: 11 },
    { Icon: GitBranch, x: '70%', y: '40%', delay: 0.8, duration: 8.5 },
    { Icon: Box, x: '90%', y: '50%', delay: 1.2, duration: 9.5 },
    { Icon: Zap, x: '5%', y: '60%', delay: 1.8, duration: 7.5 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {icons.map(({ Icon, x, y, delay, duration }, index) => (
        <motion.div
          key={index}
          className="absolute text-violet-500/20"
          style={{ left: x, top: y }}
          animate={{
            y: [0, -30, 0],
            rotate: [0, 10, -10, 0],
            scale: [1, 1.2, 1]
          }}
          transition={{
            duration,
            delay,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        >
          <Icon size={32} />
        </motion.div>
      ))}
    </div>
  );
};

const AnimatedDeveloper = () => {
  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1 }}
    >
      {/* Laptop */}
      <motion.div
        className="relative"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg width="400" height="300" viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Laptop Base */}
          <motion.path
            d="M80 200 L320 200 L340 240 L60 240 Z"
            fill="#1e293b"
            stroke="#475569"
            strokeWidth="2"
          />
          
          {/* Laptop Screen */}
          <motion.rect
          x='90'
          y='60'
          width='220'
          height='140'
          rx='8'
          fill='#0f172a'
          stroke='#475569'
          strokeWidth='3'
          />
          
          {/* Screen Glow */}
          <motion.rect
          x='100'
          y='70'
          width='200'
          height='120'
          rx='4'
          fill='url(#screenGradient)'
            animate={{
              opacity: [0.6, 1, 0.6]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />
          
          {/* Code Lines */}
          <g>
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.rect
                key={i}
                x='110'
                y={80 + i * 20}
                width={120 - i * 15}
                height='4'
                rx='2'
                fill='#22d3ee'
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: [0, 1, 0.5, 1] }}
                transition={{
                  duration: 2,
                  delay: i * 0.3,
                  repeat: Infinity,
                  repeatDelay: 3
                }}
                style={{ transformOrigin: 'left' }}
              />
            ))}
          </g>
          
          {/* Floating Brackets */}
          <motion.text
            x='260'
            y='100'
            fontSize='24'
            fill='#7c3aed'
            fontFamily='monospace'
            animate={{
              y: [100, 90, 100],
              opacity: [0.3, 1, 0.3]
            }}
            transition={{
              duration: 2,
              repeat: Infinity
            }}
          >
            {'{ }'}
          </motion.text>
          
          {/* Coffee Cup */}
          <motion.g
            animate={{
              rotate: [-5, 5, -5]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            style={{ transformOrigin: '330px 220px' }}
          >
            <rect x='320' y='210' width='30' height='35' rx='4' fill='#8b4513' stroke='#654321' strokeWidth='2'/>
            <ellipse cx='335' cy='210' rx='15' ry='5' fill='#a0522d'/>
            <path d='M350 220 Q360 220 360 230' stroke='#654321' strokeWidth='2' fill='none'/>
            
            {/* Steam */}
            {[0, 1, 2].map((i) => (
              <motion.path
                key={i}
                d={`M${328 + i * 7} 205 Q${330 + i * 7} 195 ${328 + i * 7} 185`}
                stroke='#94a3b8'
                strokeWidth='2'
                fill='none'
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ 
                  pathLength: [0, 1, 0], 
                  opacity: [0, 0.6, 0],
                  y: [0, -10, -20]
                }}
                transition={{
                  duration: 3,
                  delay: i * 0.5,
                  repeat: Infinity,
                  ease: 'easeOut'
                }}
              />
            ))}
          </motion.g>
          
          <defs>
            <linearGradient id='screenGradient' x1='0%' y1='0%' x2='0%' y2='100%'>
              <stop offset='0%' stopColor='#7c3aed' stopOpacity='0.3' />
              <stop offset='50%' stopColor='#22d3ee' stopOpacity='0.2' />
              <stop offset='100%' stopColor='#f472b6' stopOpacity='0.3' />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>
      
      {/* Floating Code Blocks */}
      <motion.div
        className="absolute top-10 -right-20 bg-slate-800/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-cyan-500/30"
        animate={{
          y: [0, -15, 0],
          rotate: [0, 5, 0]
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <code className="text-cyan-400 text-sm font-mono">const prep = () =&gt; {'{}'}</code>
      </motion.div>
      
      <motion.div
        className="absolute bottom-20 -left-20 bg-slate-800/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-violet-500/30"
        animate={{
          y: [0, 15, 0],
          rotate: [0, -5, 0]
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5
        }}
      >
        <code className="text-violet-400 text-sm font-mono">if (ready) ace()</code>
      </motion.div>
    </motion.div>
  );
};

const InterviewElements = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Lightbulb Ideas */}
      <motion.div
        className="absolute top-20 right-32"
        animate={{
          y: [0, -20, 0],
          scale: [1, 1.2, 1]
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <div className="relative">
          <div className="w-12 h-12 bg-yellow-400/20 rounded-full blur-xl absolute inset-0 animate-pulse" />
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <motion.path
              d="M9 21h6M12 3v1m0 16v1m9-9h-1M3 12H2m16.364-7.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707"
              stroke="#fbbf24"
              strokeWidth="2"
              strokeLinecap="round"
              animate={{
                opacity: [0.4, 1, 0.4]
              }}
              transition={{
                duration: 2,
                repeat: Infinity
              }}
            />
            <motion.circle
              cx="12"
              cy="12"
              r="5"
              stroke="#fbbf24"
              strokeWidth="2"
              fill="#fef3c7"
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.8, 1, 0.8]
              }}
              transition={{
                duration: 2,
                repeat: Infinity
              }}
            />
          </svg>
        </div>
      </motion.div>
      
      {/* Checklist */}
      <motion.div
        className="absolute bottom-32 left-20"
        animate={{
          rotate: [0, 3, 0],
          y: [0, -10, 0]
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <div className="bg-slate-800/60 backdrop-blur-sm p-3 rounded-lg border border-green-500/30">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="flex items-center gap-2 mb-1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.4, duration: 0.5, repeat: Infinity, repeatDelay: 5 }}
            >
              <div className="w-4 h-4 rounded border-2 border-green-400 bg-green-400/20 flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.4 + 0.3, duration: 0.3, repeat: Infinity, repeatDelay: 5 }}
                >
                  ✓
                </motion.div>
              </div>
              <span className="text-xs text-slate-300">Task {i + 1}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
      
      {/* Trophies */}
      <motion.div
        className="absolute top-40 left-16"
        animate={{
          y: [0, -15, 0],
          rotate: [0, -10, 10, 0]
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <div className="text-5xl filter drop-shadow-[0_0_20px_rgba(251,191,36,0.6)]">
          🏆
        </div>
      </motion.div>
    </div>
  );
};

const WaveBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <svg className="absolute bottom-0 w-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <motion.path
          d="M0,128L48,144C96,160,192,192,288,192C384,192,480,160,576,154.7C672,149,768,171,864,165.3C960,160,1056,128,1152,128C1248,128,1344,160,1392,176L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          fill="rgba(124, 58, 237, 0.1)"
        />
        <motion.path
          d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,213.3C672,224,768,224,864,208C960,192,1056,160,1152,149.3C1248,139,1344,149,1392,154.7L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          fill="rgba(34, 211, 238, 0.1)"
        />
      </svg>
    </div>
  );
};

const EnhancedAnimatedBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <FloatingIcons />
      <InterviewElements />
      <WaveBackground />
      
      {/* Enhanced Gradient Orbs */}
      <motion.div
        className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-violet-600/30 blur-3xl"
        animate={{
          scale: [1, 1.4, 1],
          opacity: [0.3, 0.6, 0.3],
          x: [0, 50, 0],
          y: [0, 30, 0]
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      <motion.div
        className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-cyan-500/30 blur-3xl"
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.3, 0.6, 0.3],
          x: [0, -50, 0],
          y: [0, -30, 0]
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}
      />
      
      <motion.div
        className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full bg-pink-500/20 blur-3xl"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.4, 0.2]
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}
      />
      
      {/* Matrix-like code rain */}
      <div className="absolute inset-0">
        {[...Array(10)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-cyan-500/10 font-mono text-xs"
            style={{ left: `${i * 10}%` }}
            animate={{
              y: [-100, 1000],
              opacity: [0, 0.5, 0]
            }}
            transition={{
              duration: 8 + i,
              repeat: Infinity,
              delay: i * 0.8,
              ease: "linear"
            }}
          >
            {Math.random() > 0.5 ? '01010' : '10101'}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export { AnimatedDeveloper, EnhancedAnimatedBackground };
export default EnhancedAnimatedBackground;
