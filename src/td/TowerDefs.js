export const TowerType = {
  ARROW: 'arrow',
  CANNON: 'cannon',
  ICE: 'ice',
  LIGHTNING: 'lightning',
  FIRE: 'fire',
}

export const TOWER_DEFS = {
  [TowerType.ARROW]: {
    name: 'Arrow Tower',
    description: 'Fast single-target attacks',
    cost: 50,
    range: 3,
    damage: 10,
    fireRate: 0.8,
    projectileSpeed: 12,
    color: 0x8B6914,
    accentColor: 0xCDB380,
    height: 2.5,
    radius: 0.35,
    upgrades: [
      { cost: 40, damage: 15, fireRate: 0.6, range: 3.5, name: 'Sharp Arrows' },
      { cost: 80, damage: 25, fireRate: 0.4, range: 4, name: 'Piercing Shots' },
    ],
  },
  [TowerType.CANNON]: {
    name: 'Cannon Tower',
    description: 'Area damage, slow fire',
    cost: 80,
    range: 2.5,
    damage: 30,
    fireRate: 2.0,
    projectileSpeed: 8,
    splashRadius: 1.5,
    color: 0x4A4A4A,
    accentColor: 0x888888,
    height: 2.0,
    radius: 0.45,
    upgrades: [
      { cost: 60, damage: 50, splashRadius: 2, name: 'Heavy Shells' },
      { cost: 120, damage: 80, splashRadius: 2.5, fireRate: 1.5, name: 'Devastation' },
    ],
  },
  [TowerType.ICE]: {
    name: 'Ice Tower',
    description: 'Slows enemies in range',
    cost: 60,
    range: 2.5,
    damage: 5,
    fireRate: 1.2,
    projectileSpeed: 10,
    slowFactor: 0.5,
    slowDuration: 2.0,
    color: 0x4A90D9,
    accentColor: 0xADD8E6,
    height: 2.8,
    radius: 0.3,
    upgrades: [
      { cost: 50, slowFactor: 0.3, range: 3, name: 'Deep Freeze' },
      { cost: 100, slowFactor: 0.15, slowDuration: 3, damage: 12, name: 'Permafrost' },
    ],
  },
  [TowerType.LIGHTNING]: {
    name: 'Lightning Tower',
    description: 'Chain lightning hits multiple enemies',
    cost: 100,
    range: 3,
    damage: 20,
    fireRate: 1.5,
    projectileSpeed: 20,
    chainCount: 2,
    chainDamageFalloff: 0.6,
    color: 0xDAA520,
    accentColor: 0xFFD700,
    height: 3.2,
    radius: 0.25,
    upgrades: [
      { cost: 80, chainCount: 3, damage: 30, name: 'Forked Lightning' },
      { cost: 150, chainCount: 5, damage: 45, fireRate: 1.0, name: 'Storm Caller' },
    ],
  },
  [TowerType.FIRE]: {
    name: 'Fire Tower',
    description: 'Burns enemies over time',
    cost: 75,
    range: 2,
    damage: 15,
    fireRate: 1.0,
    projectileSpeed: 10,
    burnDamage: 5,
    burnDuration: 3.0,
    color: 0xCC3300,
    accentColor: 0xFF6600,
    height: 2.6,
    radius: 0.35,
    upgrades: [
      { cost: 55, burnDamage: 10, damage: 20, name: 'Inferno' },
      { cost: 110, burnDamage: 18, burnDuration: 4, damage: 30, range: 2.5, name: 'Hellfire' },
    ],
  },
}

export function getTowerStats(type, upgradeLevel = 0) {
  const base = TOWER_DEFS[type]
  if (!base) return null
  const stats = { ...base }
  for (let i = 0; i < Math.min(upgradeLevel, base.upgrades.length); i++) {
    Object.assign(stats, base.upgrades[i])
  }
  return stats
}
