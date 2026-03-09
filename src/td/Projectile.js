import {
  Group,
  Mesh,
  SphereGeometry,
  ConeGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
} from 'three/webgpu'
import gsap from 'gsap'
import { TowerType } from './TowerDefs.js'

const _projGeoms = {}
function getProjGeom(type) {
  if (!_projGeoms[type]) {
    switch (type) {
      case TowerType.ARROW:
        _projGeoms[type] = new ConeGeometry(0.06, 0.3, 4)
        break
      case TowerType.CANNON:
        _projGeoms[type] = new SphereGeometry(0.12, 6, 4)
        break
      case TowerType.ICE:
        _projGeoms[type] = new SphereGeometry(0.08, 6, 4)
        break
      case TowerType.LIGHTNING:
        _projGeoms[type] = new SphereGeometry(0.06, 4, 3)
        break
      case TowerType.FIRE:
        _projGeoms[type] = new SphereGeometry(0.1, 6, 4)
        break
      default:
        _projGeoms[type] = new SphereGeometry(0.08, 6, 4)
    }
  }
  return _projGeoms[type]
}

const _projMats = {}
function getProjMat(type) {
  if (!_projMats[type]) {
    switch (type) {
      case TowerType.ARROW:
        _projMats[type] = new MeshStandardMaterial({ color: 0xCDB380 })
        break
      case TowerType.CANNON:
        _projMats[type] = new MeshStandardMaterial({ color: 0x333333 })
        break
      case TowerType.ICE:
        _projMats[type] = new MeshBasicMaterial({ color: 0x88CCFF })
        break
      case TowerType.LIGHTNING:
        _projMats[type] = new MeshBasicMaterial({ color: 0xFFDD00, transparent: true, opacity: 0.9 })
        break
      case TowerType.FIRE:
        _projMats[type] = new MeshBasicMaterial({ color: 0xFF4400 })
        break
      default:
        _projMats[type] = new MeshBasicMaterial({ color: 0xffffff })
    }
  }
  return _projMats[type]
}

export class Projectile {
  static ID = 0

  constructor(fireData) {
    this.id = Projectile.ID++
    this.tower = fireData.tower
    this.target = fireData.target
    this.damage = fireData.damage
    this.speed = fireData.speed
    this.type = fireData.type
    this.stats = fireData.stats
    this.isDone = false

    this.group = new Group()
    const geom = getProjGeom(this.type)
    const mat = getProjMat(this.type)
    this.mesh = new Mesh(geom, mat)
    this.mesh.castShadow = false
    this.group.add(this.mesh)

    const t = this.tower
    this.group.position.set(t.worldX, 1 + t.tileLevel * 0.5 + (t.stats.height || 2), t.worldZ)
  }

  update(dt, allEnemies, scene, gameState) {
    if (this.isDone) return

    const target = this.target
    if (!target || target.isDead) {
      this.isDone = true
      return
    }

    const tx = target.worldX
    const ty = target.worldY + (target.scale || 0.3)
    const tz = target.worldZ
    const pos = this.group.position

    const dx = tx - pos.x
    const dy = ty - pos.y
    const dz = tz - pos.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

    if (dist < 0.3) {
      this._onHit(allEnemies, scene, gameState)
      return
    }

    const step = this.speed * dt
    const ratio = step / dist
    pos.x += dx * ratio
    pos.y += dy * ratio
    pos.z += dz * ratio

    if (this.type === TowerType.ARROW) {
      this.group.lookAt(tx, ty, tz)
    }
  }

  _onHit(allEnemies, scene, gameState) {
    this.isDone = true
    const target = this.target

    if (this.type === TowerType.CANNON && this.stats.splashRadius) {
      const splashR = this.stats.splashRadius
      for (const enemy of allEnemies) {
        if (enemy.isDead) continue
        const dx = enemy.worldX - target.worldX
        const dz = enemy.worldZ - target.worldZ
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist <= splashR) {
          const falloff = 1 - (dist / splashR) * 0.5
          enemy.takeDamage(Math.floor(this.damage * falloff))
          this._checkKill(enemy, gameState)
        }
      }
      this._spawnSplashEffect(scene)
    } else {
      target.takeDamage(this.damage)
      this._checkKill(target, gameState)
    }

    if (this.type === TowerType.ICE) {
      target.applySlow(this.stats.slowFactor || 0.5, this.stats.slowDuration || 2)
    }

    if (this.type === TowerType.FIRE && this.stats.burnDamage) {
      target.applyBurn(this.stats.burnDamage, this.stats.burnDuration || 3)
    }

    if (this.type === TowerType.LIGHTNING && this.stats.chainCount) {
      this._chainLightning(allEnemies, scene, gameState)
    }
  }

  _checkKill(enemy, gameState) {
    if (enemy.isDead && enemy.reward > 0) {
      gameState.addGold(enemy.reward)
      gameState.addScore(enemy.scoreValue || 5)
      this.tower.kills++
      enemy.reward = 0
    }
  }

  _chainLightning(allEnemies, scene, gameState) {
    let current = this.target
    let chainDamage = this.damage
    const hit = new Set([current.id])
    const chainCount = this.stats.chainCount || 2
    const falloff = this.stats.chainDamageFalloff || 0.6

    for (let i = 0; i < chainCount; i++) {
      chainDamage = Math.floor(chainDamage * falloff)
      if (chainDamage < 1) break

      let nearest = null
      let nearestDist = this.stats.range * 2

      for (const enemy of allEnemies) {
        if (enemy.isDead || hit.has(enemy.id)) continue
        const dx = enemy.worldX - current.worldX
        const dz = enemy.worldZ - current.worldZ
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist < nearestDist) {
          nearestDist = dist
          nearest = enemy
        }
      }

      if (!nearest) break

      hit.add(nearest.id)
      this._drawLightningBolt(scene, current, nearest)
      nearest.takeDamage(chainDamage)
      this._checkKill(nearest, gameState)
      current = nearest
    }
  }

  _drawLightningBolt(scene, from, to) {
    const points = []
    const segments = 5
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const x = from.worldX + (to.worldX - from.worldX) * t + (i > 0 && i < segments ? (Math.random() - 0.5) * 0.3 : 0)
      const y = (from.worldY + from.scale) + ((to.worldY + to.scale) - (from.worldY + from.scale)) * t + (i > 0 && i < segments ? (Math.random() - 0.5) * 0.3 : 0)
      const z = from.worldZ + (to.worldZ - from.worldZ) * t + (i > 0 && i < segments ? (Math.random() - 0.5) * 0.3 : 0)
      points.push(x, y, z)
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(points, 3))
    const mat = new LineBasicMaterial({ color: 0xFFDD00, transparent: true, opacity: 1 })
    mat.depthTest = false
    const line = new Line(geo, mat)
    line.renderOrder = 999
    scene.add(line)

    gsap.to(mat, {
      opacity: 0,
      duration: 0.3,
      onComplete: () => {
        scene.remove(line)
        geo.dispose()
        mat.dispose()
      },
    })
  }

  _spawnSplashEffect(scene) {
    const geo = new SphereGeometry(0.5, 8, 6)
    const mat = new MeshBasicMaterial({ color: 0xFF8800, transparent: true, opacity: 0.7 })
    const splash = new Mesh(geo, mat)
    splash.position.copy(this.group.position)
    splash.renderOrder = 990
    scene.add(splash)

    gsap.to(splash.scale, { x: 3, y: 3, z: 3, duration: 0.3 })
    gsap.to(mat, {
      opacity: 0,
      duration: 0.3,
      onComplete: () => {
        scene.remove(splash)
        geo.dispose()
        mat.dispose()
      },
    })
  }

  dispose() {
    gsap.killTweensOf(this.group.position)
  }
}
