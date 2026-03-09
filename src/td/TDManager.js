import {
  Raycaster,
  Vector2,
  Mesh,
  RingGeometry,
  MeshBasicMaterial,
  DoubleSide,
  SphereGeometry,
  MeshStandardMaterial,
  CylinderGeometry,
  Group,
} from 'three/webgpu'
import gsap from 'gsap'
import { GameState, GamePhase } from './GameState.js'
import { TDInterface } from './TDInterface.js'
import { Tower } from './Tower.js'
import { TOWER_DEFS, TowerType } from './TowerDefs.js'
import { Enemy } from './Enemy.js'
import { Projectile } from './Projectile.js'
import { WaveManager } from './WaveManager.js'
import { cubeKeyToWorld, isWalkable } from './HexPathfinding.js'
import { cubeKey, offsetToCube, localToGlobalCoords } from '../hexmap/HexWFCCore.js'
import { HexTileGeometry } from '../hexmap/HexTiles.js'
import { HexGridState } from '../hexmap/HexGrid.js'
import { Sounds } from '../lib/Sounds.js'

export class TDManager {
  constructor(scene, hexMap, camera) {
    this.scene = scene
    this.hexMap = hexMap
    this.camera = camera

    this.gameState = new GameState()
    this.waveManager = new WaveManager()
    this.ui = new TDInterface(this.gameState, this)

    this.raycaster = new Raycaster()
    this.tdGroup = new Group()
    this.scene.add(this.tdGroup)

    this.spawnCell = null
    this.goalCell = null
    this.spawnMarker = null
    this.goalMarker = null
    this.pathPreview = null

    this.placementGhost = null
    this.placementType = null
    this.placementCubeKey = null
    this.placementValid = false

    this.towerPositions = new Map()
    this.activeEnemies = []
    this.activeProjectiles = []

    this._enabled = false
  }

  init() {
    this.ui.init()
    this.gameState.maxWaves = this.waveManager.maxWaves
  }

  enable() {
    if (this._enabled) return
    this._enabled = true

    const roadKeys = this.hexMap.roadCubeKeys
    if (!roadKeys || roadKeys.length < 2) {
      console.warn('[TD] No road path on map')
      return false
    }

    this.roadPath = roadKeys
    this._roadKeySet = new Set(roadKeys)
    const firstKey = roadKeys[0]
    const lastKey = roadKeys[roadKeys.length - 1]
    const firstCell = this.hexMap.globalCells.get(firstKey)
    const lastCell = this.hexMap.globalCells.get(lastKey)

    if (!firstCell || !lastCell) {
      console.warn('[TD] Road endpoint cells not found in globalCells')
      return false
    }

    this.spawnCell = { key: firstKey, cell: firstCell }
    this.goalCell = { key: lastKey, cell: lastCell }

    this._createEndpointMarkers()
    this.gameState.setPhase(GamePhase.PREPARE)
    this.ui.show()
    return true
  }

  disable() {
    this._enabled = false
    this.ui.hide()
    this._clearAll()
  }

  _createEndpointMarkers() {
    if (this.spawnMarker) {
      this.tdGroup.remove(this.spawnMarker)
      this.spawnMarker.traverse(c => c.geometry?.dispose())
    }
    if (this.goalMarker) {
      this.tdGroup.remove(this.goalMarker)
      this.goalMarker.traverse(c => c.geometry?.dispose())
    }

    const spawnPos = cubeKeyToWorld(this.spawnCell.key, this.hexMap.globalCells)
    this.spawnMarker = this._createMarker(0xe74c3c, spawnPos)
    this.tdGroup.add(this.spawnMarker)

    const goalPos = cubeKeyToWorld(this.goalCell.key, this.hexMap.globalCells)
    this.goalMarker = this._createMarker(0x2ecc71, goalPos)
    this.tdGroup.add(this.goalMarker)
  }

  _createMarker(color, pos) {
    const group = new Group()
    const baseGeo = new CylinderGeometry(0.6, 0.6, 0.15, 16)
    const baseMat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.5 })
    const base = new Mesh(baseGeo, baseMat)
    base.position.set(pos.x, pos.y + 0.1, pos.z)
    base.renderOrder = 800
    group.add(base)

    const pillarGeo = new CylinderGeometry(0.08, 0.08, 1.5, 8)
    const pillarMat = new MeshStandardMaterial({ color })
    const pillar = new Mesh(pillarGeo, pillarMat)
    pillar.position.set(pos.x, pos.y + 0.85, pos.z)
    pillar.castShadow = true
    group.add(pillar)

    const sphereGeo = new SphereGeometry(0.2, 8, 6)
    const sphereMat = new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 })
    const sphere = new Mesh(sphereGeo, sphereMat)
    sphere.position.set(pos.x, pos.y + 1.7, pos.z)
    sphere.castShadow = true
    group.add(sphere)

    gsap.to(sphere.position, { y: pos.y + 2.0, duration: 1, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    return group
  }

  startPlacement(type) {
    this.placementType = type
    this.cancelPlacementGhost()

    const def = TOWER_DEFS[type]
    const colorHex = def.color
    const geo = new CylinderGeometry(def.radius, def.radius * 1.2, def.height * 0.6, 8)
    const mat = new MeshStandardMaterial({ color: colorHex, transparent: true, opacity: 0.5 })
    this.placementGhost = new Mesh(geo, mat)
    this.placementGhost.position.set(0, -100, 0)
    this.placementGhost.renderOrder = 900
    this.tdGroup.add(this.placementGhost)

    const rangeWorld = def.range * 2
    const rangeGeo = new RingGeometry(rangeWorld - 0.05, rangeWorld, 48)
    const rangeMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, side: DoubleSide, depthWrite: false })
    this.placementRange = new Mesh(rangeGeo, rangeMat)
    this.placementRange.rotation.x = -Math.PI / 2
    this.placementRange.position.set(0, -100, 0)
    this.placementRange.renderOrder = 899
    this.tdGroup.add(this.placementRange)
  }

  cancelPlacement() {
    this.placementType = null
    this.placementCubeKey = null
    this.cancelPlacementGhost()
  }

  cancelPlacementGhost() {
    if (this.placementGhost) {
      this.tdGroup.remove(this.placementGhost)
      this.placementGhost.geometry?.dispose()
      this.placementGhost.material?.dispose()
      this.placementGhost = null
    }
    if (this.placementRange) {
      this.tdGroup.remove(this.placementRange)
      this.placementRange.geometry?.dispose()
      this.placementRange.material?.dispose()
      this.placementRange = null
    }
  }

  updatePlacementGhost(pointer) {
    if (!this.placementType || !this.placementGhost) return

    const hexMeshes = []
    const meshToGrid = new Map()
    for (const grid of this.hexMap.grids.values()) {
      if (grid.state === HexGridState.POPULATED && grid.hexMesh) {
        hexMeshes.push(grid.hexMesh)
        meshToGrid.set(grid.hexMesh, grid)
      }
    }

    this.raycaster.setFromCamera(pointer, this.camera)
    const intersects = this.raycaster.intersectObjects(hexMeshes)

    if (intersects.length === 0) {
      this.placementGhost.position.y = -100
      this.placementRange.position.y = -100
      this.placementValid = false
      this.placementCubeKey = null
      return
    }

    const hit = intersects[0]
    const grid = meshToGrid.get(hit.object)
    const batchId = hit.batchId ?? hit.instanceId
    if (!grid || batchId === undefined) return

    const tile = grid.hexTiles.find(t => t.instanceId === batchId)
    if (!tile) return

    const globalCube = grid.globalCenterCube ?? { q: 0, r: 0, s: 0 }
    const global = localToGlobalCoords(tile.gridX, tile.gridZ, grid.gridRadius, globalCube)
    const globalCubeCoords = offsetToCube(global.col, global.row)
    const cKey = cubeKey(globalCubeCoords.q, globalCubeCoords.r, globalCubeCoords.s)

    const cell = this.hexMap.globalCells.get(cKey)
    const isWalk = cell && isWalkable(cell.type)
    const isOccupied = this.towerPositions.has(cKey)
    const isOnRoad = this._roadKeySet && this._roadKeySet.has(cKey)
    const canPlace = isWalk && !isOccupied && !isOnRoad

    this.placementValid = canPlace

    this.placementCubeKey = cKey

    const worldPos = cubeKeyToWorld(cKey, this.hexMap.globalCells)
    const def = TOWER_DEFS[this.placementType]
    this.placementGhost.position.set(worldPos.x, worldPos.y + def.height * 0.3, worldPos.z)
    this.placementRange.position.set(worldPos.x, worldPos.y + 0.1, worldPos.z)

    this.placementGhost.material.color.setHex(this.placementValid ? def.color : 0xff0000)
    this.placementGhost.material.opacity = this.placementValid ? 0.5 : 0.3
  }

  tryPlaceTower() {
    if (!this.placementType || !this.placementCubeKey || !this.placementValid) return false

    const def = TOWER_DEFS[this.placementType]
    if (!this.gameState.spendGold(def.cost)) return false

    const cKey = this.placementCubeKey
    const worldPos = cubeKeyToWorld(cKey, this.hexMap.globalCells)
    const cell = this.hexMap.globalCells.get(cKey)
    const level = cell?.level || 0

    const tower = new Tower(this.placementType, worldPos.x, worldPos.z, level)
    this.gameState.towers.push(tower)
    this.towerPositions.set(cKey, tower)
    this.tdGroup.add(tower.group)

    Sounds.play('pop', 1.0, 0.15)
    this.ui._updateTowerButtons()
    return true
  }

  onPointerMove(pointer) {
    if (!this._enabled) return

    if (this.placementType) {
      this.updatePlacementGhost(pointer)
    }
  }

  onPointerDown(pointer) {
    if (!this._enabled) return false
    const phase = this.gameState.phase

    if (this.placementType) {
      if (this.placementValid) {
        this.tryPlaceTower()
        return true
      }
      return false
    }

    if (phase === GamePhase.PREPARE || phase === GamePhase.WAVE_COMPLETE || phase === GamePhase.DEFEND) {
      const tower = this._hitTestTower(pointer)
      if (tower) {
        if (this.gameState.selectedTower === tower) {
          tower.showRange(false)
          this.gameState.selectedTower = null
          this.ui._hideTowerInfo()
        } else {
          if (this.gameState.selectedTower) {
            this.gameState.selectedTower.showRange(false)
          }
          this.gameState.selectedTower = tower
          tower.showRange(true)
          this.ui.showTowerInfo(tower)
        }
        return true
      } else {
        if (this.gameState.selectedTower) {
          this.gameState.selectedTower.showRange(false)
          this.gameState.selectedTower = null
          this.ui._hideTowerInfo()
        }
      }
    }

    return false
  }

  _hitTestTower(pointer) {
    this.raycaster.setFromCamera(pointer, this.camera)
    const towerMeshes = []
    for (const tower of this.gameState.towers) {
      tower.group.traverse(child => {
        if (child.isMesh) towerMeshes.push({ mesh: child, tower })
      })
    }
    const meshes = towerMeshes.map(t => t.mesh)
    if (meshes.length === 0) return null
    const intersects = this.raycaster.intersectObjects(meshes)
    if (intersects.length === 0) return null
    const hitMesh = intersects[0].object
    return towerMeshes.find(t => t.mesh === hitMesh)?.tower || null
  }

  startNextWave() {
    const phase = this.gameState.phase
    if (phase !== GamePhase.PREPARE && phase !== GamePhase.WAVE_COMPLETE) return

    if (!this.gameState.nextWave()) return

    this.currentPath = this.roadPath
    this.waveManager.startWave(this.gameState.wave)
    Sounds.play('roll', 1.0, 0.2)
  }

  upgradeTower(tower) {
    if (tower.upgrade(this.gameState)) {
      Sounds.play('good', 1.0, 0.2)
    }
  }

  sellTower(tower) {
    const sellValue = tower.getSellValue()
    this.gameState.addGold(sellValue)

    const idx = this.gameState.towers.indexOf(tower)
    if (idx !== -1) this.gameState.towers.splice(idx, 1)

    for (const [key, t] of this.towerPositions) {
      if (t === tower) {
        this.towerPositions.delete(key)
        break
      }
    }

    tower.showRange(false)
    tower.dispose()
    this.tdGroup.remove(tower.group)
    this.gameState.selectedTower = null
    Sounds.play('pop', 1.0, 0.15)
    this.ui._updateTowerButtons()
  }

  restartGame() {
    this._clearAll()
    this.gameState.reset()
    this.disable()
    this.gameState.emit('restart', null)
  }

  _clearAll() {
    for (const tower of this.gameState.towers) {
      tower.dispose()
      this.tdGroup.remove(tower.group)
    }
    for (const enemy of this.activeEnemies) {
      enemy.dispose()
      this.tdGroup.remove(enemy.group)
    }
    for (const proj of this.activeProjectiles) {
      proj.dispose()
      this.tdGroup.remove(proj.group)
    }
    this.gameState.towers = []
    this.activeEnemies = []
    this.activeProjectiles = []
    this.towerPositions.clear()
    this.roadPath = null
    this._roadKeySet = null

    if (this.spawnMarker) {
      this.spawnMarker.traverse(c => { c.geometry?.dispose(); c.material?.dispose() })
      this.tdGroup.remove(this.spawnMarker)
      this.spawnMarker = null
    }
    if (this.goalMarker) {
      this.goalMarker.traverse(c => { c.geometry?.dispose(); c.material?.dispose() })
      this.tdGroup.remove(this.goalMarker)
      this.goalMarker = null
    }

    this.cancelPlacement()
  }

  update(dt) {
    if (!this._enabled) return
    if (this.gameState.isPaused) return

    const effectiveDt = dt * this.gameState.gameSpeed
    const phase = this.gameState.phase

    if (phase === GamePhase.DEFEND) {
      const spawnType = this.waveManager.update(effectiveDt)
      if (spawnType && this.currentPath) {
        const enemy = new Enemy(spawnType, this.currentPath, this.hexMap.globalCells, this.gameState.wave)
        this.activeEnemies.push(enemy)
        this.tdGroup.add(enemy.group)
      }

      for (const tower of this.gameState.towers) {
        const fireData = tower.update(effectiveDt, this.activeEnemies)
        if (fireData) {
          const proj = new Projectile(fireData)
          this.activeProjectiles.push(proj)
          this.tdGroup.add(proj.group)
        }
      }

      for (const proj of this.activeProjectiles) {
        proj.update(effectiveDt, this.activeEnemies, this.scene, this.gameState)
      }

      for (const enemy of this.activeEnemies) {
        enemy.update(effectiveDt, this.camera, this.activeEnemies)
        if (enemy.reachedGoal && !enemy.isDead) {
          this.gameState.loseLife(enemy.damage)
        }
      }

      this.activeProjectiles = this.activeProjectiles.filter(p => {
        if (p.isDone) {
          this.tdGroup.remove(p.group)
          p.dispose()
          return false
        }
        return true
      })

      this.activeEnemies = this.activeEnemies.filter(e => {
        if ((e.isDead || e.reachedGoal) && e.group.scale.x < 0.01) {
          this.tdGroup.remove(e.group)
          e.dispose()
          return false
        }
        return true
      })

      const allSpawned = !this.waveManager.isSpawning && this.waveManager.spawnQueue.length === 0
      const allDead = this.activeEnemies.every(e => e.isDead || e.reachedGoal)
      if (allSpawned && allDead) {
        this.gameState.setPhase(GamePhase.WAVE_COMPLETE)
        Sounds.play('good', 1.0, 0.2)
      }
    }
  }
}
