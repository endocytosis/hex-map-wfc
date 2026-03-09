import {
  Group,
  Mesh,
  CylinderGeometry,
  ConeGeometry,
  SphereGeometry,
  OctahedronGeometry,
  RingGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  DoubleSide,
} from 'three/webgpu'
import gsap from 'gsap'
import { getTowerStats, TowerType } from './TowerDefs.js'

const _materials = new Map()
function getMat(color, opts = {}) {
  const key = `${color}_${JSON.stringify(opts)}`
  if (!_materials.has(key)) {
    _materials.set(key, new MeshStandardMaterial({ color, ...opts }))
  }
  return _materials.get(key)
}

export class Tower {
  static ID = 0

  constructor(type, worldX, worldZ, tileLevel = 0) {
    this.id = Tower.ID++
    this.type = type
    this.upgradeLevel = 0
    this.worldX = worldX
    this.worldZ = worldZ
    this.tileLevel = tileLevel
    this.cooldown = 0
    this.target = null
    this.kills = 0
    this.totalDamage = 0

    this.stats = getTowerStats(type, 0)
    this.group = new Group()
    this.group.position.set(worldX, 1 + tileLevel * 0.5, worldZ)

    this._buildMesh()
    this._animateSpawn()
  }

  _buildMesh() {
    while (this.group.children.length) {
      const child = this.group.children[0]
      this.group.remove(child)
      child.geometry?.dispose()
    }

    const s = this.stats
    const baseMat = getMat(s.color)
    const accentMat = getMat(s.accentColor)

    const baseGeo = new CylinderGeometry(s.radius, s.radius * 1.2, s.height * 0.6, 8)
    const base = new Mesh(baseGeo, baseMat)
    base.position.y = s.height * 0.3
    base.castShadow = true
    base.receiveShadow = true
    this.group.add(base)

    const topGeo = new CylinderGeometry(s.radius * 0.6, s.radius, s.height * 0.35, 8)
    const top = new Mesh(topGeo, accentMat)
    top.position.y = s.height * 0.6 + s.height * 0.175
    top.castShadow = true
    this.group.add(top)

    if (this.type === TowerType.ARROW) {
      const tipGeo = new ConeGeometry(s.radius * 0.3, s.height * 0.15, 6)
      const tip = new Mesh(tipGeo, accentMat)
      tip.position.y = s.height * 0.95 + s.height * 0.075
      tip.castShadow = true
      this.group.add(tip)
    } else if (this.type === TowerType.CANNON) {
      const barrelGeo = new CylinderGeometry(s.radius * 0.25, s.radius * 0.3, s.height * 0.3, 8)
      const barrel = new Mesh(barrelGeo, getMat(0x333333))
      barrel.position.y = s.height * 0.7
      barrel.rotation.x = Math.PI / 6
      barrel.position.z = s.radius * 0.5
      barrel.castShadow = true
      this.barrel = barrel
      this.group.add(barrel)
    } else if (this.type === TowerType.ICE) {
      const crystalGeo = new OctahedronGeometry(s.radius * 0.5, 0)
      const crystalMat = getMat(0x88CCFF, { transparent: true, opacity: 0.8 })
      const crystal = new Mesh(crystalGeo, crystalMat)
      crystal.position.y = s.height + 0.3
      crystal.castShadow = true
      this.crystal = crystal
      this.group.add(crystal)
      gsap.to(crystal.rotation, { y: Math.PI * 2, duration: 4, repeat: -1, ease: 'none' })
      gsap.to(crystal.position, { y: s.height + 0.5, duration: 1.5, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    } else if (this.type === TowerType.LIGHTNING) {
      const orbGeo = new SphereGeometry(s.radius * 0.4, 8, 6)
      const orbMat = getMat(0xFFD700, { emissive: 0xFFD700, emissiveIntensity: 0.5 })
      const orb = new Mesh(orbGeo, orbMat)
      orb.position.y = s.height + 0.2
      this.orb = orb
      this.group.add(orb)
      gsap.to(orb.scale, { x: 1.3, y: 1.3, z: 1.3, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    } else if (this.type === TowerType.FIRE) {
      const brazierGeo = new CylinderGeometry(s.radius * 0.5, s.radius * 0.3, 0.3, 8)
      const brazier = new Mesh(brazierGeo, getMat(0x880000))
      brazier.position.y = s.height + 0.15
      this.group.add(brazier)
      const flameGeo = new ConeGeometry(s.radius * 0.3, 0.5, 6)
      const flameMat = getMat(0xFF4400, { emissive: 0xFF2200, emissiveIntensity: 0.6 })
      const flame = new Mesh(flameGeo, flameMat)
      flame.position.y = s.height + 0.55
      this.flame = flame
      this.group.add(flame)
      gsap.to(flame.scale, { x: 0.7, z: 0.7, y: 1.3, duration: 0.3, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    }

    this.rangeIndicator = null
  }

  showRange(show) {
    if (show && !this.rangeIndicator) {
      const rangeWorld = this.stats.range * 2
      const geo = new RingGeometry(rangeWorld - 0.05, rangeWorld, 48)
      const mat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, side: DoubleSide, depthWrite: false })
      this.rangeIndicator = new Mesh(geo, mat)
      this.rangeIndicator.rotation.x = -Math.PI / 2
      this.rangeIndicator.position.y = 0.1
      this.rangeIndicator.renderOrder = 900
      this.group.add(this.rangeIndicator)
    } else if (!show && this.rangeIndicator) {
      this.group.remove(this.rangeIndicator)
      this.rangeIndicator.geometry.dispose()
      this.rangeIndicator.material.dispose()
      this.rangeIndicator = null
    }
  }

  upgrade(gameState) {
    if (this.upgradeLevel >= this.stats.upgrades.length) return false
    const upgradeDef = this.stats.upgrades[this.upgradeLevel]
    if (!gameState.spendGold(upgradeDef.cost)) return false
    this.upgradeLevel++
    this.stats = getTowerStats(this.type, this.upgradeLevel)
    this._buildMesh()
    gsap.fromTo(this.group.scale, { x: 1.3, y: 0.7, z: 1.3 }, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'elastic.out(1, 0.5)' })
    return true
  }

  _animateSpawn() {
    this.group.scale.set(0, 0, 0)
    gsap.to(this.group.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(1.7)' })
  }

  update(dt, enemies) {
    this.cooldown -= dt
    if (this.cooldown > 0) return null

    const range = this.stats.range * 2
    let closest = null
    let closestDist = Infinity

    for (const enemy of enemies) {
      if (enemy.isDead) continue
      const dx = enemy.worldX - this.worldX
      const dz = enemy.worldZ - this.worldZ
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist <= range && dist < closestDist) {
        closest = enemy
        closestDist = dist
      }
    }

    if (!closest) return null

    this.target = closest
    this.cooldown = this.stats.fireRate
    return {
      tower: this,
      target: closest,
      damage: this.stats.damage,
      speed: this.stats.projectileSpeed,
      type: this.type,
      stats: this.stats,
    }
  }

  getSellValue() {
    let total = this.stats.cost
    for (let i = 0; i < this.upgradeLevel; i++) {
      total += this.stats.upgrades[i].cost
    }
    return Math.floor(total * 0.6)
  }

  dispose() {
    gsap.killTweensOf(this.group.scale)
    if (this.crystal) gsap.killTweensOf(this.crystal.rotation, this.crystal.position)
    if (this.orb) gsap.killTweensOf(this.orb.scale)
    if (this.flame) gsap.killTweensOf(this.flame.scale)
    this.group.traverse(child => {
      child.geometry?.dispose()
    })
    if (this.rangeIndicator) {
      this.rangeIndicator.geometry.dispose()
      this.rangeIndicator.material.dispose()
    }
  }
}
