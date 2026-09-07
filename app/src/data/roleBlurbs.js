export const roleBlurbs={
  supplements:{
    star_raider:'A daring space pilot, smuggler, or captain who lives for freedom among the stars.',
    martial_artist:'A disciplined hand-to-hand expert whose training turns body and mind into weapons.',
    swashbuckler:'A fearless, charismatic blade fighter with quick feet and impeccable flair.',
    loser:'An overlooked everyday underdog who discovers they can rise when everything is on the line.',
    apprentice:'A promising but inexperienced student learning to wield dangerous magic.',
    slayer:'A hardened hunter who tracks and destroys monsters lurking in the dark.',
    solo:'A streetwise mercenary surviving the neon future through skill, nerve, and hard choices.',
    master_of_the_multiverse:'A singular Hero who understands—and can influence—the tangled possibilities of the multiverse.',
    star_knight:'A mystic warrior who wields a star sword in defense of freedom and peace.',
    nightmare_investigator:'A determined investigator confronting cults, forbidden knowledge, and cosmic horror.',
    gunslinger:'A fast-drawing frontier Hero who lets courage and a steady aim do the talking.',
    emissary:'A supernatural agent caught between celestial and infernal powers.',
    barbarian:'A mighty warrior driven by instinct, freedom, and legendary feats of strength.',
    rookie:'An inexperienced officer learning to uphold the law when the streets turn dangerous.',
    dweller:'A hardened wasteland survivor who endures scarcity, raiders, and roaring engines.',
    npc:'A video-game supporting character who breaks free of the script and becomes the Hero.',
    good_boy:'A loyal animal Hero whose courage, instincts, and heart make them indispensable.',
    joker:'A theatrical agent of chaos who schemes, taunts, and turns villainy into a performance.',
    demigod:'A mythic Hero carrying divine power, mortal passions, and an epic destiny.',
    time_traveler:'A traveler from another age racing to protect history from disaster and paradox.',
    speed_demon:'A fearless driver who pushes every engine—and every chase—past its limits.',
    power_guardian:'A teenager who transforms into a colorful masked warrior to defend the world.',
    the_one:'A unique multiversal Hero whose many possible selves share one defining truth.',
    samurai:'A disciplined sword master guided by duty, honor, and a deadly code.',
    hired_gun:'A battle-tested professional who takes dangerous contracts and always finishes the job.',
    aristocrat:'A privileged and commanding Hero whose status opens doors—and creates obligations.',
    dog_trainer:'A capable handler whose loyal canine partner is central to every mission.',
    derelict:'A battered outcast who survives through grit, hard-earned instincts, and nothing to lose.',
    assassin:'An elite killer who relies on patience, precision, and vanishing before retaliation arrives.'
  }
}

export function roleBlurb(packId,roleId){return roleBlurbs[packId]?.[roleId]||''}
