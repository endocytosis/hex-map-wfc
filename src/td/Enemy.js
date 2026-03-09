import {
  Group,
  Mesh,
  SphereGeometry,
  BoxGeometry,
  CylinderGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  PlaneGeometry,
  DoubleSide,
  Vector3,
} from 'three/webgpu'
import gsap from 'gsap'
import { ENEMY_DEFS, EnemyType } from './EnemyDefs.js'
import { cubeKeyToWorld } from './HexPathfinding.js'

export class Enemy {
  static ID = 0

  constructor(type, path, globalCells, waveNum = 1) {
    this.id = Enemy.ID++
    this.type = type
    this.path = path
    this.globalCells = globalCells
    this.pathIndex = 0

    const def = ENEMY_DEFS[type]
    const hpScale = 1 + (waveNum - 1) * 0.25
    this.maxHp = Math.floor(def.hp * hpScale)
    this.hp = this.maxHp
    this.baseSpeed = def.speed
    this.speed = def.speed
    this.reward = def.reward
    this.damage = def.damage
    this.color = def.color
    this.scale = def.scale
    this.scoreValue = def.scoreValue
    this.healRadius = def.healRadius
    this.healAmount = def.healAmount
    this.healRate = def.healRate
    this.healCooldown = 0

    this.isDead = false
    this.reachedGoal = false
    this.worldX = 0
    this.worldY = 1
    this.worldZ = 0

    this.slowTimer = 0
    this.slowFactor = 1
    this.burnTimer = 0
    this.burnDamage = 0
    this.burnTick = 0

    this.group = new Group()
    this._buildMesh(def)

    if (path.length > 0) {
      const start = cubeKeyToWorld(path[0], globalCells)
      this.worldX = start.x
      this.worldY = start.y
      this.worldZ = start.z
      this.group.position.set(start.x, start.y, start.z)
    }

    this._animateSpawn()
  }

  _buildMesh(def) {
    const mat = new MeshStandardMaterial({ color: def.color })

    if (this.type === EnemyType.FAST) {
      const body = new Mesh(new SphereGeometry(def.scale, 8, 6), mat)
      body.position.y = def.scale
      body.castShadow = true
      this.group.add(body)
    } else if (this.type === EnemyType.TANK) {
      const body = new Mesh(new BoxGeometry(def.scale * 1.6, def.scale * 1.2, def.scale * 1.6), mat)
      body.position.y = def.scale * 0.6
      body.castShadow = true
      this.group.add(body)
    } else if (this.type === EnemyType.BOSS) {
      const body = new Mesh(new CylinderGeometry(def.scale * 0.8, def.scale, def.scale * 1.5, 8), mat)
      body.position.y = def.scale * 0.75
      body.castShadow = true
      this.group.add(body)
      const crown = new Mesh(
        new CylinderGeometry(def.scale * 0.4, def.scale * 0.6, def.scale * 0.3, 6),
        new MeshStandardMaterial({ color: 0xFFD700 })
      )
      crown.position.y = def.scale * 1.6
      crown.castShadow = true
      this.group.add(crown)
    } else if (this.type === EnemyType.HEALER) {
      const body = new Mesh(new SphereGeometry(def.scale, 8, 6), mat)
      body.position.y = def.scale
      body.castShadow = true
      this.group.add(body)
      const cross = new Mesh(
        new BoxGeometry(def.scale * 0.15, def.scale * 0.6, def.scale * 0.15),
        new MeshStandardMaterial({ color: 0x00FF88 })
      )
      cross.position.y = def.scale * 1.5
      this.group.add(cross)
      const crossH = new Mesh(
        new BoxGeometry(def.scale * 0.6, def.scale * 0.15, def.scale * 0.15),
        new MeshStandardMaterial({ color: 0x00FF88 })
      )
      crossH.position.y = def.scale * 1.5
      this.group.add(crossH)
    } else {
      const body = new Mesh(new SphereGeometry(def.scale, 8, 6), mat)
      body.position.y = def.scale
      body.castShadow = true
      this.group.add(body)
    }

    this._createHealthBar(def)
  }

  _createHealthBar(def) {
    const w = def.scale * 2.5
    const h = 0.08
    const bgGeo = new PlaneGeometry(w, h)
    const bgMat = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, side: DoubleSide, depthTest: false })
    this.healthBarBg = new Mesh(bgGeo, bgMat)
    this.healthBarBg.renderOrder = 950
    this.healthBarBg.position.y = def.scale * 2.2 + 0.2

    const fgGeo = new PlaneGeometry(w, h)
    const fgMat = new MeshBasicMaterial({ color: 0x00CC44, transparent: true, opacity: 0.9, side: DoubleSide, depthTest: false })
    this.healthBarFg = new Mesh(fgGeo, fgMat)
    this.healthBarFg.renderOrder = 951
    this.healthBarFg.position.y = def.scale * 2.2 + 0.2

    this.healthBarWidth = w
    this.group.add(this.healthBarBg)
    this.group.add(this.healthBarFg)
  }

  _updateHealthBar(camera) {
    const pct = Math.max(0, this.hp / this.maxHp)
    const w = this.healthBarWidth

    this.healthBarFg.scale.x = pct
    this.healthBarFg.position.x = -(1 - pct) * w * 0.5

    if (pct > 0.6) {
      this.healthBarFg.material.color.setHex(0x00CC44)
    } else if (pct > 0.3) {
      this.healthBarFg.material.color.setHex(0xCCAA00)
    } else {
      this.healthBarFg.material.color.setHex(0xCC2200)
    }

    if (camera) {
      this.healthBarBg.lookAt(camera.position)
      this.healthBarFg.lookAt(camera.position)
    }
  }

  _animateSpawn() {
    this.group.scale.set(0, 0, 0)
    gsap.to(this.group.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'back.out(1.7)' })
  }

  takeDamage(amount) {
    if (this.isDead) return
    this.hp -= amount
    if (this.hp <= 0) {
      this.hp = 0
      this.isDead = true
      this._animateDeath()
    }
  }

  applySlow(factor, duration) {
    this.slowFactor = Math.min(this.slowFactor, factor)
    this.slowTimer = Math.max(this.slowTimer, duration)
  }

  applyBurn(damage, duration) {
    this.burnDamage = Math.max(this.burnDamage, damage)
    this.burnTimer = Math.max(this.burnTimer, duration)
  }

  heal(amount) {
    if (this.isDead) return
    this.hp = Math.min(this.hp + amount, this.maxHp)
  }

  _animateDeath() {
    gsap.to(this.group.scale, {
      x: 0, y: 0, z: 0,
      duration: 0.3,
      ease: 'power2.in',
    })
    gsap.to(this.group.position, {
      y: this.group.position.y - 0.5,
      duration: 0.3,
    })
  }

  update(dt, camera, allEnemies) {
    if (this.isDead || this.reachedGoal) return

    if (this.slowTimer > 0) {
      this.slowTimer -= dt
      this.speed = this.baseSpeed * this.slowFactor
      if (this.slowTimer <= 0) {
        this.speed = this.baseSpeed
        this.slowFactor = 1
      }
    }

    if (this.burnTimer > 0) {
      this.burnTimer -= dt
      this.burnTick -= dt
      if (this.burnTick <= 0) {
        this.burnTick = 0.5
        this.takeDamage(this.burnDamage)
      }
      if (this.burnTimer <= 0) {
        this.burnDamage = 0
      }
    }

    if (this.healAmount && this.healRadius) {
      this.healCooldown -= dt
      if (this.healCooldown <= 0) {
        this.healCooldown = this.healRate || 2.0
        for (const other of allEnemies) {
          if (other === this || other.isDead) continue
          const dx = other.worldX - this.worldX
          const dz = other.worldZ - this.worldZ
          const dist = Math.sqrt(dx * dx + dz * dz)
          if (dist <= this.healRadius) {
            other.heal(this.healAmount)
          }
        }
      }
    }

    if (this.pathIndex >= this.path.length - 1) {
      this.reachedGoal = true
      this._animateDeath()
      return
    }

    const nextKey = this.path[this.pathIndex + 1]
    const target = cubeKeyToWorld(nextKey, this.globalCells)
    const dx = target.x - this.worldX
    const dy = target.y - this.worldY
    const dz = target.z - this.worldZ
    const dist = Math.sqrt(dx * dx + dz * dz)
    const step = this.speed * dt

    if (dist <= step) {
      this.worldX = target.x
      this.worldY = target.y
      this.worldZ = target.z
      this.pathIndex++
    } else {
      const ratio = step / dist
      this.worldX += dx * ratio
      this.worldY += dy * ratio
      this.worldZ += dz * ratio
    }

    this.group.position.set(this.worldX, this.worldY, this.worldZ)

    if (dist > 0.01) {
      const angle = Math.atan2(dx, dz)
      this.group.rotation.y = angle
    }

    this._updateHealthBar(camera)
  }

  dispose() {
    gsap.killTweensOf(this.group.scale)
    gsap.killTweensOf(this.group.position)
    this.group.traverse(child => {
      child.geometry?.dispose()
      child.material?.dispose()
    })
  }
}
