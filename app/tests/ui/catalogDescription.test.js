import {describe,expect,it} from 'vitest'
import {contentPacks,gameData} from '../../src/data.js'
import {catalogDescription} from '../../src/ui/catalogDescription.js'

describe('guided catalog descriptions',()=>{
  it('provides a blurb for every Role and Trope',()=>{
    const catalogs=[gameData.roles.roles,gameData.tropes.tropes,...contentPacks.flatMap(pack=>[pack.roles,pack.tropes])]
    for(const catalog of catalogs)for(const [id,item] of Object.entries(catalog))expect(catalogDescription(item),id).toBeTruthy()
  })

  it('gives every guided Role an authored description',()=>{
    const roles=[...Object.values(gameData.roles.roles),...contentPacks.flatMap(pack=>Object.values(pack.roles))]
    for(const role of roles)expect(role.tagline||role.blurb||role.summary,role.name).toBeTruthy()
  })

  it('keeps the clipped all-caps Role tagline style',()=>{
    expect(catalogDescription(gameData.roles.roles.commando)).toBe('STRONG. WELL TRAINED. UNSTOPPABLE.')
    const roles=contentPacks.flatMap(pack=>Object.values(pack.roles))
    for(const role of roles){const description=catalogDescription(role);expect(description,role.name).toBe(description.toUpperCase());expect(description.match(/\./g)?.length,role.name).toBeGreaterThanOrEqual(3)}
  })

  it('renders Trope descriptions as clipped all-caps taglines',()=>{
    expect(catalogDescription(gameData.tropes.tropes.bad_to_the_bone)).toBe('DANGEROUS. ARROGANT TROUBLEMAKER. MAY STILL CHOOSE TO DO THE RIGHT THING.')
    const catalogs=[gameData.tropes.tropes,...contentPacks.map(pack=>pack.tropes)]
    for(const trope of catalogs.flatMap(catalog=>Object.values(catalog))){const description=catalogDescription(trope);expect(description,trope.name).toBe(description.toUpperCase())}
  })

  it('uses authored color instead of mechanical fallback text for every built-in Trope',()=>{
    const tropes=[...Object.values(gameData.tropes.tropes),...contentPacks.flatMap(pack=>Object.values(pack.tropes))]
    for(const trope of tropes){
      expect(trope.blurb||trope.tagline||trope.prompt||trope.summary,trope.name).toBeTruthy()
      expect(catalogDescription(trope),trope.name).not.toMatch(/DRIVEN BY|SKILLED AT/)
    }
  })

  it('does not repeat Action Flick Trope names in their blurbs',()=>{
    const tropes=contentPacks.find(pack=>pack.id==='supplements').tropes
    for(const trope of Object.values(tropes).filter(value=>value.source.startsWith('OG_Action_Flicks'))){
      const name=trope.name.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/[’']/g,"[’']")
      expect(catalogDescription(trope),trope.name).not.toMatch(new RegExp(`(^|[^A-Z0-9])${name}([^A-Z0-9]|$)`))
    }
  })

  it('uses source-informed expansion Trope taglines',()=>{
    const adventure=contentPacks.find(pack=>pack.id==='adventure').tropes
    const superheroes=contentPacks.find(pack=>pack.id==='superheroes').tropes
    const supplements=contentPacks.find(pack=>pack.id==='supplements').tropes
    expect(catalogDescription(adventure.adventure__action_archeologist)).toBe('BODY AND MIND IN BALANCE. THEORY MEETS FIELDWORK. EVERY TREASURE BELONGS IN A MUSEUM.')
    expect(catalogDescription(superheroes.superheroes__anti_hero)).toBe('SELF-SERVING HERO. STILL FINDS THE COURAGE TO DO RIGHT WHEN NEEDED.')
    expect(catalogDescription(supplements.supplements__logical_thinker)).toBe('CALM UNDER PRESSURE. COLDLY RATIONAL. DOES WHAT LOGIC DEMANDS.')
    expect(catalogDescription(supplements.supplements__world_of_killers_battle_butler)).toBe('IMPECCABLE SERVICE. BRUTAL FISTICUFFS. PERFECT FOR GALAS AND BARROOM BRAWLS.')
  })

  it('uses curated clipped taglines for superhero Roles',()=>{
    const armored=contentPacks.find(pack=>pack.id==='superheroes').roles.superheroes__armored
    expect(catalogDescription(armored)).toBe('ARMORED. HIGH-TECH. ALWAYS PREPARED.')
  })

  it('uses the published taglines for Adventure, Action Flicks, and World of Killers Roles',()=>{
    const expected={
      adventure:{
        daredevil:'BRAVE. RECKLESS. HAS HAD WORSE.',
        guardian:'SELFLESS. WILL WATCH YOUR BACK. ADAMANT.',
        captain:'WELL-TRAVELED. EYES ON THE HORIZON. PASSIONATE.',
        hunter:'DEAD SHOT. ALWAYS WATCHING. WILD.',
        heart:'SMILING. WISE. BELIEVES IN YOU.',
        star:'BRILLIANT. CONFIDENT. MORE THAN ELEGANT.',
        professor:'SCHOLAR. BOOKWORM. PATHOLOGICALLY CURIOUS.',
        technician:'SPECIALIZED. CAN FIX IT. PRACTICAL.',
        scoundrel:'SMILING. ONE STEP AHEAD. SLIPPERY.',
        smuggler:'CUNNING. LITTLE REMORSE. KNOWS HISTORY.'
      },
      supplements:{
        star_raider:'RESOURCEFUL. CUNNING. STAR-STRUCK.',
        martial_artist:'IN BALANCE. FURY. ANCIENT ARTS.',
        swashbuckler:'ROMANTIC. SWORD FIGHTER. ALWAYS READY.',
        loser:'ALWAYS LAST. NOSEBLEEDS. STUBBORN.',
        apprentice:'AMBITIOUS. DESTINED FOR GREATNESS. UNPREPARED.',
        slayer:'VIOLENT. RELENTLESS. NOCTURNAL.',
        solo:'SERIOUS. ON THE EDGE. HARDENED.',
        master_of_the_multiverse:'TRAVELER. MYSTERIOUS. FOR THE GREATER GOOD.',
        star_knight:'IN BALANCE. RIGHTEOUS. ONE WITH THE POWER.',
        nightmare_investigator:'TORMENTED. BAD DAY. COOL HEAD.',
        gunslinger:'FINGER ON THE TRIGGER. QUICK. WILD.',
        emissary:'PERSUASIVE. ON AN ERRAND. METICULOUS.',
        barbarian:'MIGHTY. BLOODTHIRSTY. RAGING.',
        rookie:'EAGER. WET BEHIND THE EARS. FULL OF SURPRISES.',
        dweller:'RESOLUTE. FAR FROM HOME. SURVIVOR.',
        npc:'IN THE BACKGROUND. HERE FOR YOU. VIRTUAL.',
        good_boy:'LOYAL. PROTECTIVE INSTINCTS. BRAVE.',
        joker:'SMILING. UNPREDICTABLE. NOT SO SERIOUS.',
        demigod:'UNBEATABLE. SEARCHING FOR GLORY. EPIC.',
        time_traveler:'BRILLIANT. ALWAYS ON THE MOVE. TIMELY.',
        speed_demon:'FAST. RECKLESS. ALWAYS IN THE LEAD.',
        power_guardian:'FAIR. ALWAYS A TEAM. COLORFUL.',
        the_one:'UNIQUE. RATIONAL. ASPIRING TO PERFECTION.',
        samurai:'KATANA. HONORABLE. INFLEXIBLE.',
        hired_gun:'LETHAL. BULLETS RAIN. INFALLIBLE.',
        aristocrat:'ELEGANT. EVERYTHING UNDER CONTROL. SNOB.',
        dog_trainer:'LOYAL FRIEND. GROWL. TEAM PLAY.',
        derelict:'INVISIBLE. REJECTED BY SOCIETY. CUNNING.',
        assassin:'SHADOW. HIDDEN BLADE. HOODED.'
      }
    }
    for(const [packId,taglines] of Object.entries(expected)){
      const roles=contentPacks.find(pack=>pack.id===packId).roles
      for(const [roleId,tagline] of Object.entries(taglines))expect(catalogDescription(roles[`${packId}__${roleId}`]),roleId).toBe(tagline)
    }
  })
})
