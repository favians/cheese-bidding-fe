export interface WowClassDefinition {
  name: string
  slug: string
  color: string
  icon: string
  specializations: string[]
}

export const wowClasses: WowClassDefinition[] = [
  { name: 'Druid', slug: 'druid', color: '#FF7C0A', icon: '/icons/classes/druid.png', specializations: ['Balance', 'Feral Combat', 'Restoration'] },
  { name: 'Hunter', slug: 'hunter', color: '#AAD372', icon: '/icons/classes/hunter.png', specializations: ['Beast Mastery', 'Marksmanship', 'Survival'] },
  { name: 'Mage', slug: 'mage', color: '#3FC7EB', icon: '/icons/classes/mage.png', specializations: ['Arcane', 'Fire', 'Frost'] },
  { name: 'Paladin', slug: 'paladin', color: '#F58CBA', icon: '/icons/classes/paladin.png', specializations: ['Holy', 'Protection', 'Retribution'] },
  { name: 'Priest', slug: 'priest', color: '#FFFFFF', icon: '/icons/classes/priest.png', specializations: ['Discipline', 'Holy', 'Shadow'] },
  { name: 'Rogue', slug: 'rogue', color: '#FFF468', icon: '/icons/classes/rogue.png', specializations: ['Assassination', 'Combat', 'Subtlety'] },
  { name: 'Shaman', slug: 'shaman', color: '#0070DD', icon: '/icons/classes/shaman.png', specializations: ['Elemental', 'Enhancement', 'Restoration'] },
  { name: 'Warlock', slug: 'warlock', color: '#8788EE', icon: '/icons/classes/warlock.png', specializations: ['Affliction', 'Demonology', 'Destruction'] },
  { name: 'Warrior', slug: 'warrior', color: '#C69B6D', icon: '/icons/classes/warrior.png', specializations: ['Arms', 'Fury', 'Protection'] }
]
