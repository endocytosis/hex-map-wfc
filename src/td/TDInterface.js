import { GamePhase } from './GameState.js'
import { TOWER_DEFS, TowerType, getTowerStats } from './TowerDefs.js'

export class TDInterface {
  constructor(gameState, tdManager) {
    this.gameState = gameState
    this.tdManager = tdManager
    this.container = null
    this.elements = {}
    this._visible = false
  }

  init() {
    this.container = document.createElement('div')
    this.container.id = 'td-ui'
    this.container.style.cssText = `display: none; position: fixed; inset: 0; pointer-events: none; z-index: 100; font-family: 'Inter', sans-serif;`
    document.body.appendChild(this.container)

    this._createTopBar()
    this._createTowerPanel()
    this._createWaveButton()
    this._createTowerInfo()
    this._createGameOverlay()

    this.gameState.on('goldChange', () => this._updateTopBar())
    this.gameState.on('livesChange', () => this._updateTopBar())
    this.gameState.on('waveChange', () => this._updateTopBar())
    this.gameState.on('scoreChange', () => this._updateTopBar())
    this.gameState.on('phaseChange', (data) => this._onPhaseChange(data))
  }

  _createTopBar() {
    const bar = document.createElement('div')
    bar.style.cssText = `
      position: absolute; top: 10px; right: 10px;
      display: flex; gap: 16px; align-items: center;
      background: rgba(0,0,0,0.65); backdrop-filter: blur(8px);
      border-radius: 10px; padding: 8px 18px;
      pointer-events: auto; color: #fff; font-size: 13px;
      text-shadow: 0 1px 3px rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.12);
    `
    this.container.appendChild(bar)

    const items = [
      { key: 'lives', label: 'Lives', color: '#e74c3c', icon: '\u2764' },
      { key: 'gold', label: 'Gold', color: '#f1c40f', icon: '\u2B50' },
      { key: 'wave', label: 'Wave', color: '#3498db', icon: '\u2694' },
      { key: 'score', label: 'Score', color: '#2ecc71', icon: '\u2605' },
    ]

    for (const item of items) {
      const el = document.createElement('div')
      el.style.cssText = `display: flex; align-items: center; gap: 6px;`
      const icon = document.createElement('span')
      icon.textContent = item.icon
      icon.style.cssText = `font-size: 15px; filter: drop-shadow(0 0 3px ${item.color});`
      const value = document.createElement('span')
      value.style.fontWeight = '500'
      el.appendChild(icon)
      el.appendChild(value)
      bar.appendChild(el)
      this.elements[item.key] = value
    }

    this._updateTopBar()
  }

  _updateTopBar() {
    const gs = this.gameState
    this.elements.lives.textContent = gs.lives
    this.elements.gold.textContent = gs.gold
    this.elements.wave.textContent = `${gs.wave}/${gs.maxWaves}`
    this.elements.score.textContent = gs.score
  }

  _createTowerPanel() {
    const panel = document.createElement('div')
    panel.id = 'tower-panel'
    panel.style.cssText = `
      position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 8px; padding: 10px 14px;
      background: rgba(0,0,0,0.65); backdrop-filter: blur(8px);
      border-radius: 12px; pointer-events: auto;
      border: 1px solid rgba(255,255,255,0.12);
    `
    this.container.appendChild(panel)
    this.elements.towerPanel = panel

    for (const [type, def] of Object.entries(TOWER_DEFS)) {
      const btn = document.createElement('button')
      btn.dataset.towerType = type
      btn.style.cssText = `
        width: 64px; height: 72px; border: 2px solid rgba(255,255,255,0.2);
        border-radius: 8px; background: rgba(30,30,30,0.8);
        cursor: pointer; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 2px;
        transition: all 0.15s ease; color: #ccc; font-size: 10px;
        font-family: 'Inter', sans-serif; padding: 4px;
      `
      const colorHex = '#' + def.color.toString(16).padStart(6, '0')
      const dot = document.createElement('div')
      dot.style.cssText = `width: 20px; height: 20px; border-radius: 50%;
        background: ${colorHex}; box-shadow: 0 0 6px ${colorHex}80;`
      const name = document.createElement('div')
      name.textContent = def.name.split(' ')[0]
      name.style.cssText = 'font-weight: 500; font-size: 10px; line-height: 1.1;'
      const cost = document.createElement('div')
      cost.textContent = `${def.cost}g`
      cost.style.cssText = 'color: #f1c40f; font-size: 10px;'
      btn.appendChild(dot)
      btn.appendChild(name)
      btn.appendChild(cost)

      btn.addEventListener('mouseenter', () => {
        if (this.gameState.selectedTowerType === type) return
        btn.style.borderColor = 'rgba(255,255,255,0.5)'
        btn.style.background = 'rgba(50,50,50,0.9)'
      })
      btn.addEventListener('mouseleave', () => {
        if (this.gameState.selectedTowerType === type) return
        btn.style.borderColor = 'rgba(255,255,255,0.2)'
        btn.style.background = 'rgba(30,30,30,0.8)'
      })
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        this._selectTowerType(type)
      })

      panel.appendChild(btn)
    }
  }

  _selectTowerType(type) {
    if (this.gameState.selectedTowerType === type) {
      this.gameState.selectedTowerType = null
      this.tdManager.cancelPlacement()
    } else {
      this.gameState.selectedTowerType = type
      this.gameState.selectedTower = null
      this.tdManager.startPlacement(type)
    }
    this._updateTowerButtons()
    this._hideTowerInfo()
  }

  _updateTowerButtons() {
    const btns = this.elements.towerPanel.querySelectorAll('button')
    for (const btn of btns) {
      const type = btn.dataset.towerType
      const def = TOWER_DEFS[type]
      const selected = this.gameState.selectedTowerType === type
      const affordable = this.gameState.gold >= def.cost
      btn.style.borderColor = selected ? '#fff' : 'rgba(255,255,255,0.2)'
      btn.style.background = selected ? 'rgba(255,255,255,0.15)' : 'rgba(30,30,30,0.8)'
      btn.style.opacity = affordable ? '1' : '0.4'
      btn.style.pointerEvents = affordable ? 'auto' : 'none'
    }
  }

  _createWaveButton() {
    const btn = document.createElement('button')
    btn.id = 'wave-btn'
    btn.style.cssText = `
      position: absolute; bottom: 100px; right: 16px;
      padding: 12px 24px; border: 2px solid rgba(41,128,185,0.6);
      border-radius: 10px; background: rgba(41,128,185,0.3);
      backdrop-filter: blur(8px); color: #fff; font-size: 14px;
      font-weight: 500; cursor: pointer; pointer-events: auto;
      font-family: 'Inter', sans-serif;
      transition: all 0.2s ease;
      text-shadow: 0 1px 3px rgba(0,0,0,0.5);
    `
    btn.textContent = 'Start Wave 1'
    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = 'rgba(41,128,185,0.9)'
      btn.style.background = 'rgba(41,128,185,0.5)'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = 'rgba(41,128,185,0.6)'
      btn.style.background = 'rgba(41,128,185,0.3)'
    })
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.tdManager.startNextWave()
    })
    this.container.appendChild(btn)
    this.elements.waveBtn = btn
  }

  _createTowerInfo() {
    const panel = document.createElement('div')
    panel.id = 'tower-info'
    panel.style.cssText = `
      position: absolute; bottom: 100px; left: 16px;
      min-width: 200px; padding: 14px 18px;
      background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
      border-radius: 10px; pointer-events: auto;
      color: #fff; font-size: 12px; display: none;
      border: 1px solid rgba(255,255,255,0.12);
    `
    this.container.appendChild(panel)
    this.elements.towerInfo = panel
  }

  showTowerInfo(tower) {
    const panel = this.elements.towerInfo
    const def = TOWER_DEFS[tower.type]
    const stats = tower.stats

    let html = `
      <div style="font-size:14px;font-weight:500;margin-bottom:8px;color:#fff">${def.name} Lv.${tower.upgradeLevel + 1}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:11px;color:rgba(255,255,255,0.7)">
        <div>Damage: <span style="color:#e74c3c">${stats.damage}</span></div>
        <div>Range: <span style="color:#3498db">${stats.range}</span></div>
        <div>Fire Rate: <span style="color:#f39c12">${stats.fireRate.toFixed(1)}s</span></div>
        <div>Kills: <span style="color:#2ecc71">${tower.kills}</span></div>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px">
    `

    if (tower.upgradeLevel < def.upgrades.length) {
      const upg = def.upgrades[tower.upgradeLevel]
      html += `<button id="btn-upgrade" style="flex:1;padding:6px 10px;border:1px solid rgba(46,204,113,0.5);border-radius:6px;background:rgba(46,204,113,0.2);color:#2ecc71;cursor:pointer;font-size:11px;font-family:'Inter',sans-serif">${upg.name} (${upg.cost}g)</button>`
    }

    const sellVal = tower.getSellValue()
    html += `<button id="btn-sell" style="flex:1;padding:6px 10px;border:1px solid rgba(231,76,60,0.5);border-radius:6px;background:rgba(231,76,60,0.2);color:#e74c3c;cursor:pointer;font-size:11px;font-family:'Inter',sans-serif">Sell (${sellVal}g)</button>`
    html += '</div>'
    panel.innerHTML = html
    panel.style.display = 'block'

    const upgradeBtn = panel.querySelector('#btn-upgrade')
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.tdManager.upgradeTower(tower)
        this.showTowerInfo(tower)
        this._updateTowerButtons()
      })
    }

    const sellBtn = panel.querySelector('#btn-sell')
    sellBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.tdManager.sellTower(tower)
      this._hideTowerInfo()
    })
  }

  _hideTowerInfo() {
    this.elements.towerInfo.style.display = 'none'
    this.gameState.selectedTower = null
  }

  _createGameOverlay() {
    const overlay = document.createElement('div')
    overlay.id = 'game-overlay'
    overlay.style.cssText = `
      position: absolute; inset: 0;
      display: none; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.6); pointer-events: auto; z-index: 200;
    `
    const card = document.createElement('div')
    card.style.cssText = `
      text-align: center; padding: 32px 48px;
      background: rgba(20,20,20,0.9); border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.15);
      backdrop-filter: blur(12px);
    `
    const title = document.createElement('div')
    title.id = 'overlay-title'
    title.style.cssText = 'font-size: 28px; font-weight: 600; color: #fff; margin-bottom: 8px;'
    const sub = document.createElement('div')
    sub.id = 'overlay-sub'
    sub.style.cssText = 'font-size: 14px; color: rgba(255,255,255,0.6); margin-bottom: 20px;'
    const btn = document.createElement('button')
    btn.id = 'overlay-btn'
    btn.style.cssText = `
      padding: 10px 28px; border: 2px solid rgba(255,255,255,0.3);
      border-radius: 8px; background: rgba(255,255,255,0.1);
      color: #fff; font-size: 14px; cursor: pointer;
      font-family: 'Inter', sans-serif; font-weight: 500;
      transition: all 0.15s ease;
    `
    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = 'rgba(255,255,255,0.6)'
      btn.style.background = 'rgba(255,255,255,0.2)'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = 'rgba(255,255,255,0.3)'
      btn.style.background = 'rgba(255,255,255,0.1)'
    })
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.tdManager.restartGame()
    })
    card.appendChild(title)
    card.appendChild(sub)
    card.appendChild(btn)
    overlay.appendChild(card)
    this.container.appendChild(overlay)
    this.elements.gameOverlay = overlay
  }

  _onPhaseChange({ from, to }) {
    const waveBtn = this.elements.waveBtn
    const overlay = this.elements.gameOverlay

    if (to === GamePhase.BUILD) {
      waveBtn.style.display = 'none'
      overlay.style.display = 'none'
      this.elements.towerPanel.style.display = 'none'
    } else if (to === GamePhase.PREPARE) {
      waveBtn.style.display = 'block'
      waveBtn.textContent = `Start Wave ${this.gameState.wave + 1}`
      this.elements.towerPanel.style.display = 'flex'
      this._updateTowerButtons()
    } else if (to === GamePhase.DEFEND) {
      waveBtn.style.display = 'none'
    } else if (to === GamePhase.WAVE_COMPLETE) {
      if (this.gameState.wave >= this.gameState.maxWaves) {
        this.gameState.setPhase(GamePhase.VICTORY)
        return
      }
      waveBtn.style.display = 'block'
      waveBtn.textContent = `Start Wave ${this.gameState.wave + 1}`
      this._updateTowerButtons()
    } else if (to === GamePhase.GAME_OVER) {
      overlay.style.display = 'flex'
      overlay.querySelector('#overlay-title').textContent = 'Defeat'
      overlay.querySelector('#overlay-title').style.color = '#e74c3c'
      overlay.querySelector('#overlay-sub').textContent = `Survived ${this.gameState.wave} waves | Score: ${this.gameState.score}`
      overlay.querySelector('#overlay-btn').textContent = 'Try Again'
    } else if (to === GamePhase.VICTORY) {
      overlay.style.display = 'flex'
      overlay.querySelector('#overlay-title').textContent = 'Victory!'
      overlay.querySelector('#overlay-title').style.color = '#2ecc71'
      overlay.querySelector('#overlay-sub').textContent = `All waves defeated | Score: ${this.gameState.score}`
      overlay.querySelector('#overlay-btn').textContent = 'Play Again'
    }
  }

  show() {
    this._visible = true
    this.container.style.display = 'block'
    this._updateTopBar()
    this._updateTowerButtons()
  }

  hide() {
    this._visible = false
    this.container.style.display = 'none'
    this._hideTowerInfo()
  }

  dispose() {
    this.container?.remove()
  }
}
