import gsap from 'gsap'

export const GamePhase = {
  BUILD: 'build',
  PREPARE: 'prepare',
  DEFEND: 'defend',
  WAVE_COMPLETE: 'wave_complete',
  GAME_OVER: 'game_over',
  VICTORY: 'victory',
}

export class GameState {
  constructor() {
    this.phase = GamePhase.BUILD
    this.gold = 200
    this.lives = 20
    this.wave = 0
    this.maxWaves = 10
    this.score = 0
    this.towers = []
    this.enemies = []
    this.projectiles = []
    this.selectedTowerType = null
    this.selectedTower = null
    this.placementValid = false
    this.listeners = new Map()
    this.isPaused = false
    this.gameSpeed = 1
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, [])
    this.listeners.get(event).push(callback)
  }

  emit(event, data) {
    const cbs = this.listeners.get(event)
    if (cbs) cbs.forEach(cb => cb(data))
  }

  setPhase(phase) {
    const prev = this.phase
    this.phase = phase
    this.emit('phaseChange', { from: prev, to: phase })
  }

  addGold(amount) {
    this.gold += amount
    this.emit('goldChange', this.gold)
  }

  spendGold(amount) {
    if (this.gold < amount) return false
    this.gold -= amount
    this.emit('goldChange', this.gold)
    return true
  }

  loseLife(amount = 1) {
    this.lives -= amount
    this.emit('livesChange', this.lives)
    if (this.lives <= 0) {
      this.lives = 0
      this.setPhase(GamePhase.GAME_OVER)
    }
  }

  addScore(amount) {
    this.score += amount
    this.emit('scoreChange', this.score)
  }

  nextWave() {
    this.wave++
    this.emit('waveChange', this.wave)
    if (this.wave > this.maxWaves) {
      this.setPhase(GamePhase.VICTORY)
      return false
    }
    this.setPhase(GamePhase.DEFEND)
    return true
  }

  reset() {
    this.gold = 200
    this.lives = 20
    this.wave = 0
    this.score = 0
    this.towers = []
    this.enemies = []
    this.projectiles = []
    this.selectedTowerType = null
    this.selectedTower = null
    this.isPaused = false
    this.gameSpeed = 1
    this.setPhase(GamePhase.BUILD)
  }
}
