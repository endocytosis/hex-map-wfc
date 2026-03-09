import { EnemyType } from './EnemyDefs.js'

const WAVE_DEFS = [
  { enemies: [{ type: EnemyType.GRUNT, count: 6 }], spawnInterval: 1.2 },
  { enemies: [{ type: EnemyType.GRUNT, count: 8 }, { type: EnemyType.FAST, count: 3 }], spawnInterval: 1.0 },
  { enemies: [{ type: EnemyType.GRUNT, count: 6 }, { type: EnemyType.FAST, count: 5 }], spawnInterval: 0.9 },
  { enemies: [{ type: EnemyType.TANK, count: 3 }, { type: EnemyType.GRUNT, count: 6 }], spawnInterval: 1.1 },
  { enemies: [{ type: EnemyType.FAST, count: 10 }, { type: EnemyType.HEALER, count: 2 }], spawnInterval: 0.7 },
  { enemies: [{ type: EnemyType.TANK, count: 4 }, { type: EnemyType.GRUNT, count: 8 }, { type: EnemyType.HEALER, count: 2 }], spawnInterval: 0.9 },
  { enemies: [{ type: EnemyType.FAST, count: 12 }, { type: EnemyType.TANK, count: 3 }], spawnInterval: 0.6 },
  { enemies: [{ type: EnemyType.GRUNT, count: 10 }, { type: EnemyType.TANK, count: 5 }, { type: EnemyType.HEALER, count: 3 }], spawnInterval: 0.8 },
  { enemies: [{ type: EnemyType.FAST, count: 15 }, { type: EnemyType.TANK, count: 4 }, { type: EnemyType.HEALER, count: 3 }], spawnInterval: 0.5 },
  { enemies: [{ type: EnemyType.BOSS, count: 1 }, { type: EnemyType.TANK, count: 6 }, { type: EnemyType.HEALER, count: 4 }, { type: EnemyType.GRUNT, count: 10 }], spawnInterval: 0.8 },
]

export class WaveManager {
  constructor() {
    this.waveIndex = 0
    this.spawnQueue = []
    this.spawnTimer = 0
    this.spawnInterval = 1
    this.isSpawning = false
    this.waveDone = false
  }

  startWave(waveNum) {
    this.waveIndex = Math.min(waveNum - 1, WAVE_DEFS.length - 1)
    const def = WAVE_DEFS[this.waveIndex]

    this.spawnQueue = []
    for (const group of def.enemies) {
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push(group.type)
      }
    }

    for (let i = this.spawnQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]]
    }

    this.spawnInterval = def.spawnInterval
    this.spawnTimer = 0
    this.isSpawning = true
    this.waveDone = false
  }

  update(dt) {
    if (!this.isSpawning || this.spawnQueue.length === 0) return null

    this.spawnTimer -= dt
    if (this.spawnTimer > 0) return null

    this.spawnTimer = this.spawnInterval
    const enemyType = this.spawnQueue.shift()

    if (this.spawnQueue.length === 0) {
      this.isSpawning = false
    }

    return enemyType
  }

  get totalEnemies() {
    const def = WAVE_DEFS[Math.min(this.waveIndex, WAVE_DEFS.length - 1)]
    return def.enemies.reduce((sum, g) => sum + g.count, 0)
  }

  get maxWaves() {
    return WAVE_DEFS.length
  }
}
