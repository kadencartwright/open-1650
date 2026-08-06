import { mkdir, writeFile } from "node:fs/promises";

// Transcribed from the Free Church of Scotland's May 2026 words-only
// digital edition, using its official plain-text screen export to retain
// logical metrical lines. See each generated record for source metadata.
// PDF: https://freechurch.org/wp-content/uploads/2026/05/Scottish-Psalter-Words-Only-Digital-Edition.pdf
// PDF SHA-256: c7242e632093f0b10042468011650374514d2ccbf9f3733055bb91ad9bd717a3
// Plain text: https://freechurch.org/wp-content/uploads/2025/10/PlainText.zip
// Plain-text ZIP SHA-256: b81ecb106b668fb648c4748d9ebcca6ff7a6d3affd6175da6abf9c0d8b2c3905
const sourceRecords = [
  {
    "psalm_number": 2,
    "source_version": "single version",
    "meter": {
      "pattern": "8.6.8.6",
      "name": "Common Meter"
    },
    "source_pages": {
      "printed_pages": "7-8",
      "pdf_zero_based_pages": "6-7"
    },
    "archive_member": "Scottish Psalter/Scottish-Psalter-002-(T) [C.M.].txt",
    "stanzas": [
      {
        "number": 1,
        "biblical_verses": [
          1,
          2
        ],
        "lines": [
          "Why rage the heathen? and vain things",
          "why do the people mind?",
          "Kings of the earth do set themselves,",
          "and princes are combined,"
        ]
      },
      {
        "number": 2,
        "biblical_verses": [
          2,
          3
        ],
        "lines": [
          "To plot against the LORD, and his",
          "Anointed, saying thus,",
          "Let us asunder break their bands,",
          "and cast their cords from us."
        ]
      },
      {
        "number": 3,
        "biblical_verses": [
          4,
          5
        ],
        "lines": [
          "He that in heaven sits shall laugh;",
          "the Lord shall scorn them all.",
          "Then shall he speak to them in wrath,",
          "in rage he vex them shall."
        ]
      },
      {
        "number": 4,
        "biblical_verses": [
          6
        ],
        "lines": [
          "Yet, notwithstanding, I have him",
          "to be my King appointed;",
          "And over Zion, my holy hill,",
          "I have him King anointed."
        ]
      },
      {
        "number": 5,
        "biblical_verses": [
          7
        ],
        "lines": [
          "The sure decree I will declare;",
          "the LORD hath said to me,",
          "Thou art mine only Son; this day",
          "I have begotten thee."
        ]
      },
      {
        "number": 6,
        "biblical_verses": [
          8
        ],
        "lines": [
          "Ask of me, and for heritage",
          "the heathen I’ll make thine;",
          "And, for possession, I to thee",
          "will give earth’s utmost line."
        ]
      },
      {
        "number": 7,
        "biblical_verses": [
          9
        ],
        "lines": [
          "Thou shalt, as with a weighty rod",
          "of iron, break them all;",
          "And, as a potter’s sherd, thou shalt",
          "them dash in pieces small."
        ]
      },
      {
        "number": 8,
        "biblical_verses": [
          10,
          11
        ],
        "lines": [
          "Now, therefore, kings, be wise; be taught,",
          "ye judges of the earth:",
          "Serve GOD in fear, and see that ye",
          "join trembling with your mirth."
        ]
      },
      {
        "number": 9,
        "biblical_verses": [
          12
        ],
        "lines": [
          "Kiss ye the Son, lest in his ire",
          "ye perish from the way,",
          "If once his wrath begin to burn:",
          "bless’d all that on him stay."
        ]
      }
    ]
  },
  {
    "psalm_number": 3,
    "source_version": "single version",
    "meter": {
      "pattern": "8.6.8.6",
      "name": "Common Meter"
    },
    "source_pages": {
      "printed_pages": "8",
      "pdf_zero_based_pages": "7"
    },
    "archive_member": "Scottish Psalter/Scottish-Psalter-003-(T) [C.M.].txt",
    "stanzas": [
      {
        "number": 1,
        "biblical_verses": [
          1,
          2
        ],
        "lines": [
          "O LORD, how are my foes increased?",
          "against me many rise.",
          "Many say of my soul, For him",
          "in God no succour lies."
        ]
      },
      {
        "number": 2,
        "biblical_verses": [
          3,
          4
        ],
        "lines": [
          "Yet thou my strength and glory art,",
          "th’ uplifter of mine head.",
          "I cried, and, from his holy hill,",
          "the LORD me answer made."
        ]
      },
      {
        "number": 3,
        "biblical_verses": [
          5,
          6
        ],
        "lines": [
          "I laid me down and slept, I waked;",
          "for GOD sustainèd me.",
          "I will not fear though thousands ten",
          "set round against me be."
        ]
      },
      {
        "number": 4,
        "biblical_verses": [
          7
        ],
        "lines": [
          "Arise, O LORD; save me, my God;",
          "for thou my foes hast stroke",
          "All on the cheek-bone, and the teeth",
          "of wicked men hast broke."
        ]
      },
      {
        "number": 5,
        "biblical_verses": [
          8
        ],
        "lines": [
          "Salvätion doth appertain",
          "unto the LORD alone:",
          "Thy blessing, Lord, for evermore",
          "thy people is upon."
        ]
      }
    ]
  },
  {
    "psalm_number": 4,
    "source_version": "single version",
    "meter": {
      "pattern": "8.6.8.6",
      "name": "Common Meter"
    },
    "source_pages": {
      "printed_pages": "8-9",
      "pdf_zero_based_pages": "7-8"
    },
    "archive_member": "Scottish Psalter/Scottish-Psalter-004-(T) [C.M.].txt",
    "stanzas": [
      {
        "number": 1,
        "biblical_verses": [
          1
        ],
        "lines": [
          "Give ear unto me when I call,",
          "God of my righteousness:",
          "Have mercy, hear my prayer; thou hast",
          "enlarged me in distress."
        ]
      },
      {
        "number": 2,
        "biblical_verses": [
          2
        ],
        "lines": [
          "O ye the sons of men! how long",
          "will ye love vanities?",
          "How long my glory turn to shame,",
          "and will ye follow lies?"
        ]
      },
      {
        "number": 3,
        "biblical_verses": [
          3
        ],
        "lines": [
          "But know, that for himself the LORD",
          "the godly man doth choose:",
          "The LORD, when I on him do call,",
          "to hear will not refuse."
        ]
      },
      {
        "number": 4,
        "biblical_verses": [
          4,
          5
        ],
        "lines": [
          "Fear, and sin not; talk with your heart",
          "on bed, and silent be.",
          "Off’rings present of righteousness,",
          "and in the LORD trust ye."
        ]
      },
      {
        "number": 5,
        "biblical_verses": [
          6
        ],
        "lines": [
          "O who will show us any good?",
          "is that which many say:",
          "But of thy countenance the light,",
          "LORD, lift on us alway."
        ]
      },
      {
        "number": 6,
        "biblical_verses": [
          7
        ],
        "lines": [
          "Upon my heart, bestowed by thee,",
          "more gladness I have found",
          "Than they, ev’n then, when corn and wine",
          "did most with them abound."
        ]
      },
      {
        "number": 7,
        "biblical_verses": [
          8
        ],
        "lines": [
          "I will both lay me down in peace,",
          "and quiet sleep will take;",
          "Because thou only me to dwell",
          "in safety, LORD, dost make."
        ]
      }
    ]
  },
  {
    "psalm_number": 8,
    "source_version": "single version",
    "meter": {
      "pattern": "8.6.8.6",
      "name": "Common Meter"
    },
    "source_pages": {
      "printed_pages": "13-14",
      "pdf_zero_based_pages": "12-13"
    },
    "archive_member": "Scottish Psalter/Scottish-Psalter-008-(T) [C.M.].txt",
    "stanzas": [
      {
        "number": 1,
        "biblical_verses": [
          1
        ],
        "lines": [
          "How excellent in all the earth,",
          "LORD, our Lord, is thy name!",
          "Who hast thy glory far advanced",
          "above the starry frame."
        ]
      },
      {
        "number": 2,
        "biblical_verses": [
          2
        ],
        "lines": [
          "From infants’ and from sucklings’ mouth",
          "thou didest strength ordain,",
          "For thy foes’ cause, that so thou might’st",
          "th’ avenging foe restrain."
        ]
      },
      {
        "number": 3,
        "biblical_verses": [
          3
        ],
        "lines": [
          "When I look up unto the heav’ns,",
          "which thine own fingers framed,",
          "Unto the moon, and to the stars,",
          "which were by thee ordained;"
        ]
      },
      {
        "number": 4,
        "biblical_verses": [
          4
        ],
        "lines": [
          "Then say I, What is man, that he",
          "remembered is by thee?",
          "Or what the son of man, that thou",
          "so kind to him should’st be?"
        ]
      },
      {
        "number": 5,
        "biblical_verses": [
          5
        ],
        "lines": [
          "For thou a little lower hast",
          "him than the angels made;",
          "With glory and with dignity",
          "thou crownèd hast his head."
        ]
      },
      {
        "number": 6,
        "biblical_verses": [
          6,
          7
        ],
        "lines": [
          "Of thy hands’ works thou mad’st him lord,",
          "all under ’s feet didst lay;",
          "All sheep and oxen, yea, and beasts",
          "that in the field do stray;"
        ]
      },
      {
        "number": 7,
        "biblical_verses": [
          8,
          9
        ],
        "lines": [
          "Fowls of the air, fish of the sea,",
          "all that pass through the same.",
          "How excellent in all the earth,",
          "LORD, our Lord, is thy name!"
        ]
      }
    ]
  },
  {
    "psalm_number": 15,
    "source_version": "single version",
    "meter": {
      "pattern": "8.6.8.6",
      "name": "Common Meter"
    },
    "source_pages": {
      "printed_pages": "19",
      "pdf_zero_based_pages": "18"
    },
    "archive_member": "Scottish Psalter/Scottish-Psalter-015-(T) [C.M.].txt",
    "stanzas": [
      {
        "number": 1,
        "biblical_verses": [
          1
        ],
        "lines": [
          "Within thy tabernacle, LORD,",
          "who shall abide with thee?",
          "And in thy high and holy hill",
          "who shall a dweller be?"
        ]
      },
      {
        "number": 2,
        "biblical_verses": [
          2
        ],
        "lines": [
          "The man that walketh uprightly,",
          "and worketh righteousness,",
          "And as he thinketh in his heart,",
          "so doth he truth express."
        ]
      },
      {
        "number": 3,
        "biblical_verses": [
          3
        ],
        "lines": [
          "Who doth not slander with his tongue,",
          "nor to his friend doth hurt;",
          "Nor yet against his neighbour doth",
          "take up an ill report."
        ]
      },
      {
        "number": 4,
        "biblical_verses": [
          4
        ],
        "lines": [
          "In whose eyes vile men are despised;",
          "but those that GOD do fear",
          "He honoureth; and changeth not,",
          "though to his hurt he swear."
        ]
      },
      {
        "number": 5,
        "biblical_verses": [
          5
        ],
        "lines": [
          "His coin puts not to usury,",
          "nor take reward will he",
          "Against the guiltless. Who doth thus",
          "shall never moved be."
        ]
      }
    ]
  },
  {
    "psalm_number": 19,
    "source_version": "single version",
    "meter": {
      "pattern": "8.6.8.6",
      "name": "Common Meter"
    },
    "source_pages": {
      "printed_pages": "25-26",
      "pdf_zero_based_pages": "24-25"
    },
    "archive_member": "Scottish Psalter/Scottish-Psalter-019-(T) [C.M.].txt",
    "stanzas": [
      {
        "number": 1,
        "biblical_verses": [
          1,
          2
        ],
        "lines": [
          "The heav’ns God’s glory do declare,",
          "the skies his hand-works preach:",
          "Day utters speech to day, and night",
          "to night doth knowledge teach."
        ]
      },
      {
        "number": 2,
        "biblical_verses": [
          3,
          4
        ],
        "lines": [
          "There is no speech nor tongue to which",
          "their voice doth not extend:",
          "Their line is gone through all the earth,",
          "their words to the world’s end."
        ]
      },
      {
        "number": 3,
        "biblical_verses": [
          4,
          5
        ],
        "lines": [
          "In them he set the sun a tent;",
          "Who, bridegroom-like, forth goes",
          "From’s chamber, as a strong man doth",
          "to run his race rejoice."
        ]
      },
      {
        "number": 4,
        "biblical_verses": [
          6
        ],
        "lines": [
          "From heav’n’s end is his going forth,",
          "circling to th’ end again;",
          "And there is nothing from his heat",
          "that hidden doth remain."
        ]
      },
      {
        "number": 5,
        "biblical_verses": [
          7
        ],
        "lines": [
          "GOD’s law is perfect, and converts",
          "the soul in sin that lies:",
          "GOD’s testimony is most sure,",
          "and makes the simple wise."
        ]
      },
      {
        "number": 6,
        "biblical_verses": [
          8
        ],
        "lines": [
          "The statutes of the LORD are right,",
          "and do rejoice the heart:",
          "The LORD’s command is pure, and doth",
          "light to the eyes impart."
        ]
      },
      {
        "number": 7,
        "biblical_verses": [
          9
        ],
        "lines": [
          "Unspotted is the fear of GOD,",
          "and doth endure for ever:",
          "The judgments of the LORD are true",
          "and righteous altogether."
        ]
      },
      {
        "number": 8,
        "biblical_verses": [
          10
        ],
        "lines": [
          "They more than gold, yea, much fine gold,",
          "to be desirèd are:",
          "Than honey, honey from the comb",
          "that droppeth, sweeter far."
        ]
      },
      {
        "number": 9,
        "biblical_verses": [
          11
        ],
        "lines": [
          "Moreover, they thy servant warn",
          "how he his life should frame:",
          "A great reward provided is",
          "for them that keep the same."
        ]
      },
      {
        "number": 10,
        "biblical_verses": [
          12,
          13
        ],
        "lines": [
          "Who can his errors understand?",
          "O cleanse thou me within",
          "From secret faults. Thy servant keep",
          "from all presumptuous sin:"
        ]
      },
      {
        "number": 11,
        "biblical_verses": [
          13
        ],
        "lines": [
          "And do not suffer them to have",
          "dominion over me:",
          "Then rïghteous and innocent",
          "I from much sin shall be."
        ]
      },
      {
        "number": 12,
        "biblical_verses": [
          14
        ],
        "lines": [
          "The words which from my mouth proceed,",
          "the thoughts sent from my heart,",
          "Accept, O LORD, for thou my strength",
          "and my Redeemer art."
        ]
      }
    ]
  },
  {
    "psalm_number": 24,
    "source_version": "single version",
    "meter": {
      "pattern": "8.6.8.6",
      "name": "Common Meter"
    },
    "source_pages": {
      "printed_pages": "31-32",
      "pdf_zero_based_pages": "30-31"
    },
    "archive_member": "Scottish Psalter/Scottish-Psalter-024-(T) [C.M.].txt",
    "stanzas": [
      {
        "number": 1,
        "biblical_verses": [
          1
        ],
        "lines": [
          "The earth belongs unto the LORD,",
          "and all that it contains;",
          "The world that is inhabited,",
          "and all that there remains."
        ]
      },
      {
        "number": 2,
        "biblical_verses": [
          2
        ],
        "lines": [
          "For the foundätions thereof",
          "he on the seas did lay,",
          "And he hath it establishèd",
          "upon the floods to stay."
        ]
      },
      {
        "number": 3,
        "biblical_verses": [
          3
        ],
        "lines": [
          "Who is the man that shall ascend",
          "into the hill of GOD?",
          "Or who within his holy place",
          "shall have a firm abode?"
        ]
      },
      {
        "number": 4,
        "biblical_verses": [
          4
        ],
        "lines": [
          "Whose hands are clean, whose heart is pure,",
          "and unto vanity",
          "Who hath not lifted up his soul,",
          "nor sworn deceitfully."
        ]
      },
      {
        "number": 5,
        "biblical_verses": [
          5
        ],
        "lines": [
          "He from th’ ETERNAL shall receive",
          "the blessing him upon,",
          "And righteousness, ev’n from the God",
          "of his salvätion."
        ]
      },
      {
        "number": 6,
        "biblical_verses": [
          6
        ],
        "lines": [
          "This is the generätion",
          "that after him enquire,",
          "O Jacob, who do seek thy face",
          "with their whole heart’s desire."
        ]
      },
      {
        "number": 7,
        "biblical_verses": [
          7
        ],
        "lines": [
          "Ye gates, lift up your heads on high;",
          "ye doors that last for aye,",
          "Be lifted up, that so the King",
          "of glory enter may."
        ]
      },
      {
        "number": 8,
        "biblical_verses": [
          8
        ],
        "lines": [
          "But who of glory is the King?",
          "The mighty LORD is this;",
          "Ev’n that same LORD, that great in might",
          "and strong in battle is."
        ]
      },
      {
        "number": 9,
        "biblical_verses": [
          9
        ],
        "lines": [
          "Ye gates, lift up your heads; ye doors,",
          "doors that do last for aye,",
          "Be lifted up, that so the King",
          "of glory enter may."
        ]
      },
      {
        "number": 10,
        "biblical_verses": [
          10
        ],
        "lines": [
          "But who is he that is the King",
          "of glory? who is this?",
          "The LORD of hosts, and none but he,",
          "the King of glory is."
        ]
      }
    ]
  },
  {
    "psalm_number": 42,
    "source_version": "single version",
    "meter": {
      "pattern": "8.6.8.6",
      "name": "Common Meter"
    },
    "source_pages": {
      "printed_pages": "58-59",
      "pdf_zero_based_pages": "57-58"
    },
    "archive_member": "Scottish Psalter/Scottish-Psalter-042-(T) [C.M.].txt",
    "stanzas": [
      {
        "number": 1,
        "biblical_verses": [
          1
        ],
        "lines": [
          "Like as the hart for water-brooks",
          "in thirst doth pant and bray;",
          "So pants my longing soul, O God,",
          "that come to thee I may."
        ]
      },
      {
        "number": 2,
        "biblical_verses": [
          2
        ],
        "lines": [
          "My soul for God, the living God,",
          "doth thirst: when shall I near",
          "Unto thy countenance approach,",
          "and in God’s sight appear?"
        ]
      },
      {
        "number": 3,
        "biblical_verses": [
          3
        ],
        "lines": [
          "My tears have unto me been meat,",
          "both in the night and day,",
          "While unto me continually,",
          "Where is thy God? they say."
        ]
      },
      {
        "number": 4,
        "biblical_verses": [
          4
        ],
        "lines": [
          "My soul is pourèd out in me,",
          "when this I think upon;",
          "Because that with the multitude",
          "I heretofore had gone:"
        ]
      },
      {
        "number": 5,
        "biblical_verses": [
          4
        ],
        "lines": [
          "With them into God’s house I went,",
          "with voice of joy and praise;",
          "Yea, with the multitude that kept",
          "the solemn holy days."
        ]
      },
      {
        "number": 6,
        "biblical_verses": [
          5
        ],
        "lines": [
          "O why art thou cast down, my soul?",
          "why in me so dismayed?",
          "Trust God, for I shall praise him yet,",
          "his count’nance is mine aid."
        ]
      },
      {
        "number": 7,
        "biblical_verses": [
          6
        ],
        "lines": [
          "My God, my soul’s cast down in me;",
          "thee therefore mind I will",
          "From Jordan’s land, the Hermonites,",
          "and ev’n from Mizar hill."
        ]
      },
      {
        "number": 8,
        "biblical_verses": [
          7
        ],
        "lines": [
          "At the noise of thy water-spouts",
          "deep unto deep doth call;",
          "Thy breaking waves pass over me,",
          "yea, and thy billows all."
        ]
      },
      {
        "number": 9,
        "biblical_verses": [
          8
        ],
        "lines": [
          "His loving-kindness yet the LORD",
          "command will in the day,",
          "His song’s with me by night; to God,",
          "by whom I live, I’ll pray:"
        ]
      },
      {
        "number": 10,
        "biblical_verses": [
          9
        ],
        "lines": [
          "And I will say to God my rock,",
          "Why me forgett’st thou so?",
          "Why, for my foes’ opprëssion,",
          "thus mourning do I go?"
        ]
      },
      {
        "number": 11,
        "biblical_verses": [
          10
        ],
        "lines": [
          "’Tis as a sword within my bones,",
          "when my foes me upbraid;",
          "Ev’n when by them, Where is thy God?",
          "’tis daily to me said."
        ]
      },
      {
        "number": 12,
        "biblical_verses": [
          11
        ],
        "lines": [
          "O why art thou cast down, my soul?",
          "why, thus with grief oppressed,",
          "Art thou disquieted in me?",
          "in God still hope and rest:"
        ]
      },
      {
        "number": 13,
        "biblical_verses": [
          11
        ],
        "lines": [
          "For yet I know I shall him praise,",
          "who graciously to me",
          "The health is of my countenance,",
          "yea, mine own God is he."
        ]
      }
    ]
  },
  {
    "psalm_number": 46,
    "source_version": "single version",
    "meter": {
      "pattern": "8.6.8.6",
      "name": "Common Meter"
    },
    "source_pages": {
      "printed_pages": "65-66",
      "pdf_zero_based_pages": "64-65"
    },
    "archive_member": "Scottish Psalter/Scottish-Psalter-046-(T) [C.M.].txt",
    "stanzas": [
      {
        "number": 1,
        "biblical_verses": [
          1,
          2
        ],
        "lines": [
          "God is our refuge and our strength,",
          "in straits a present aid;",
          "Therefore, although the earth remove,",
          "we will not be afraid:"
        ]
      },
      {
        "number": 2,
        "biblical_verses": [
          2,
          3
        ],
        "lines": [
          "Though hills amidst the seas be cast;",
          "Though waters roaring make,",
          "And troubled be; yea, though the hills",
          "by swelling seas do shake."
        ]
      },
      {
        "number": 3,
        "biblical_verses": [
          4
        ],
        "lines": [
          "A river is, whose streams do glad",
          "the city of our God;",
          "The holy place, wherein the Lord",
          "most high hath his abode."
        ]
      },
      {
        "number": 4,
        "biblical_verses": [
          5
        ],
        "lines": [
          "God in the midst of her doth dwell;",
          "nothing shall her remove:",
          "The Lord to her an helper will,",
          "and that right early, prove."
        ]
      },
      {
        "number": 5,
        "biblical_verses": [
          6
        ],
        "lines": [
          "The heathen raged tumultuously,",
          "the kingdoms movèd were:",
          "The Lord God utterèd his voice,",
          "the earth did melt for fear."
        ]
      },
      {
        "number": 6,
        "biblical_verses": [
          7
        ],
        "lines": [
          "The LORD of hosts upon our side",
          "doth constantly remain:",
          "The God of Jacob’s our refuge,",
          "us safely to maintain."
        ]
      },
      {
        "number": 7,
        "biblical_verses": [
          8
        ],
        "lines": [
          "Come, and behold what wondrous works",
          "have by the LORD been wrought;",
          "Come, see what desolätions",
          "he on the earth hath brought."
        ]
      },
      {
        "number": 8,
        "biblical_verses": [
          9
        ],
        "lines": [
          "Unto the ends of all the earth",
          "wars into peace he turns:",
          "The bow he breaks, the spear he cuts,",
          "in fire the chariot burns."
        ]
      },
      {
        "number": 9,
        "biblical_verses": [
          10
        ],
        "lines": [
          "Be still, and know that I am God;",
          "among the heathen I",
          "Will be exalted; I on earth",
          "will be exalted high."
        ]
      },
      {
        "number": 10,
        "biblical_verses": [
          11
        ],
        "lines": [
          "Our God, who is the LORD of hosts,",
          "is still upon our side;",
          "The God of Jacob our refuge",
          "for ever will abide."
        ]
      }
    ]
  },
  {
    "psalm_number": 51,
    "source_version": "single version",
    "meter": {
      "pattern": "8.6.8.6",
      "name": "Common Meter"
    },
    "source_pages": {
      "printed_pages": "73-74",
      "pdf_zero_based_pages": "72-73"
    },
    "archive_member": "Scottish Psalter/Scottish-Psalter-051-(T) [C.M.].txt",
    "stanzas": [
      {
        "number": 1,
        "biblical_verses": [
          1
        ],
        "lines": [
          "After thy loving-kindness, Lord,",
          "have mercy upon me:",
          "For thy compassions great, blot out",
          "all mine iniquity."
        ]
      },
      {
        "number": 2,
        "biblical_verses": [
          2,
          3
        ],
        "lines": [
          "Me cleanse from sin, and throughly wash",
          "from mine iniquity:",
          "For my transgressions I confess;",
          "my sin I ever see."
        ]
      },
      {
        "number": 3,
        "biblical_verses": [
          4
        ],
        "lines": [
          "’Gainst thee, thee only, have I sinned,",
          "in thy sight done this ill;",
          "That when thou speak’st thou may’st be just,",
          "and clear in judging still."
        ]
      },
      {
        "number": 4,
        "biblical_verses": [
          5
        ],
        "lines": [
          "Behold, I in iniquity",
          "was formed the womb within;",
          "My mother also me conceived",
          "in guiltiness and sin."
        ]
      },
      {
        "number": 5,
        "biblical_verses": [
          6
        ],
        "lines": [
          "Behold, thou in the inward parts",
          "with truth delighted art;",
          "And wisdom thou shalt make me know",
          "within the hidden part."
        ]
      },
      {
        "number": 6,
        "biblical_verses": [
          7
        ],
        "lines": [
          "Do thou with hyssop sprinkle me,",
          "I shall be cleansèd so;",
          "Yea, wash thou me, and then I shall",
          "be whiter than the snow."
        ]
      },
      {
        "number": 7,
        "biblical_verses": [
          8
        ],
        "lines": [
          "Of gladness and of joyfulness",
          "make me to hear the voice;",
          "That so these very bones which thou",
          "hast broken may rejoice."
        ]
      },
      {
        "number": 8,
        "biblical_verses": [
          9,
          10
        ],
        "lines": [
          "All mine iniquities blot out,",
          "thy face hide from my sin.",
          "Create a clean heart, Lord, renew",
          "a right spirit me within."
        ]
      },
      {
        "number": 9,
        "biblical_verses": [
          11,
          12
        ],
        "lines": [
          "Cast me not from thy sight, nor take",
          "thy Holy Spirit away.",
          "Restore me thy salvation’s joy;",
          "with thy free Spirit me stay."
        ]
      },
      {
        "number": 10,
        "biblical_verses": [
          13
        ],
        "lines": [
          "Then will I teach thy ways unto",
          "those that transgressors be;",
          "And those that sinners are shall then",
          "be turnèd unto thee."
        ]
      },
      {
        "number": 11,
        "biblical_verses": [
          14
        ],
        "lines": [
          "O God, of my salvation God,",
          "me from blood-guiltiness",
          "Set free; then shall my tongue aloud",
          "sing of thy righteousness."
        ]
      },
      {
        "number": 12,
        "biblical_verses": [
          15
        ],
        "lines": [
          "My closèd lips, O Lord, by thee",
          "let them be openèd;",
          "Then shall thy praises by my mouth",
          "abroad be publishèd."
        ]
      },
      {
        "number": 13,
        "biblical_verses": [
          16
        ],
        "lines": [
          "For thou desir’st not sacrifice,",
          "else would I give it thee;",
          "Nor wilt thou with burnt-offering",
          "at all delighted be."
        ]
      },
      {
        "number": 14,
        "biblical_verses": [
          17
        ],
        "lines": [
          "A broken spirit is to God",
          "a pleasing sacrifice:",
          "A broken and a contrite heart,",
          "Lord, thou wilt not despise."
        ]
      },
      {
        "number": 15,
        "biblical_verses": [
          18
        ],
        "lines": [
          "Show kindness, and do good, O Lord,",
          "to Zion, thine own hill:",
          "The walls of thy Jerusalem",
          "build up of thy good will."
        ]
      },
      {
        "number": 16,
        "biblical_verses": [
          19
        ],
        "lines": [
          "Then righteous off’rings shall thee please,",
          "and off’rings burnt, which they",
          "With whole burnt-off’rings, and with calves,",
          "shall on thine altar lay."
        ]
      }
    ]
  },
  {
    "psalm_number": 63,
    "source_version": "single version",
    "meter": {
      "pattern": "8.6.8.6",
      "name": "Common Meter"
    },
    "source_pages": {
      "printed_pages": "85-86",
      "pdf_zero_based_pages": "84-85"
    },
    "archive_member": "Scottish Psalter/Scottish-Psalter-063-(T) [C.M.].txt",
    "stanzas": [
      {
        "number": 1,
        "biblical_verses": [
          1
        ],
        "lines": [
          "Lord, thee my God, I’ll early seek:",
          "my soul doth thirst for thee;",
          "My flesh longs in a dry parched land,",
          "wherein no waters be:"
        ]
      },
      {
        "number": 2,
        "biblical_verses": [
          2
        ],
        "lines": [
          "That I thy powèr may behold,",
          "and brightness of thy face,",
          "As I have seen thee heretofore",
          "within thy holy place."
        ]
      },
      {
        "number": 3,
        "biblical_verses": [
          3,
          4
        ],
        "lines": [
          "Since better is thy love than life,",
          "my lips thee praise shall give.",
          "I in thy name will lift my hands,",
          "and bless thee while I live."
        ]
      },
      {
        "number": 4,
        "biblical_verses": [
          5
        ],
        "lines": [
          "Ev’n as with marrow and with fat",
          "my soul shall fillèd be;",
          "Then shall my mouth with joyful lips",
          "sing praises unto thee:"
        ]
      },
      {
        "number": 5,
        "biblical_verses": [
          6
        ],
        "lines": [
          "When I do thee upon my bed",
          "remember with delight,",
          "And when on thee I meditate",
          "in watches of the night."
        ]
      },
      {
        "number": 6,
        "biblical_verses": [
          7,
          8
        ],
        "lines": [
          "In shadow of thy wings I’ll joy,",
          "for thou mine help hast been.",
          "My soul thee follows hard; and me",
          "thy right hand doth sustain."
        ]
      },
      {
        "number": 7,
        "biblical_verses": [
          9,
          10
        ],
        "lines": [
          "Who seek my soul to spill shall sink",
          "down to earth’s lowest room.",
          "They by the sword shall be cut off,",
          "and foxes’ prey become."
        ]
      },
      {
        "number": 8,
        "biblical_verses": [
          11
        ],
        "lines": [
          "Yet shall the king in God rejoice,",
          "and each one glory shall",
          "That swear by him; but stopped shall be",
          "the mouth of liars all."
        ]
      }
    ]
  },
  {
    "psalm_number": 67,
    "source_version": "first version",
    "meter": {
      "pattern": "6.6.8.6",
      "name": "Short Meter"
    },
    "source_pages": {
      "printed_pages": "89-90",
      "pdf_zero_based_pages": "88-89"
    },
    "archive_member": "Scottish Psalter/Scottish-Psalter-067,-first-version-(T) [S.M.].txt",
    "stanzas": [
      {
        "number": 1,
        "biblical_verses": [
          1,
          2
        ],
        "lines": [
          "Lord, bless and pity us,",
          "shine on us with thy face:",
          "That th’ earth thy way, and nations all",
          "may know thy saving grace."
        ]
      },
      {
        "number": 2,
        "biblical_verses": [
          3,
          4
        ],
        "lines": [
          "Let people praise thee, Lord;",
          "let people all thee praise.",
          "O let the nätions be glad,",
          "in songs their voices raise:"
        ]
      },
      {
        "number": 3,
        "biblical_verses": [
          4,
          5
        ],
        "lines": [
          "Thou ’lt justly people judge,",
          "on earth rule nations all.",
          "Let people praise thee, Lord; let them",
          "praise thee, both great and small."
        ]
      },
      {
        "number": 4,
        "biblical_verses": [
          6,
          7
        ],
        "lines": [
          "The earth her fruit shall yield,",
          "our God shall blessing send.",
          "God shall us bless; men shall him fear",
          "unto earth’s utmost end."
        ]
      }
    ]
  },
  {
    "psalm_number": 84,
    "source_version": "single version",
    "meter": {
      "pattern": "8.6.8.6",
      "name": "Common Meter"
    },
    "source_pages": {
      "printed_pages": "120-121",
      "pdf_zero_based_pages": "119-120"
    },
    "archive_member": "Scottish Psalter/Scottish-Psalter-084-(T) [C.M.].txt",
    "stanzas": [
      {
        "number": 1,
        "biblical_verses": [
          1
        ],
        "lines": [
          "How lovely is thy dwelling-place,",
          "O LORD of hosts, to me!",
          "The tabernacles of thy grace",
          "how pleasant, LORD, they be!"
        ]
      },
      {
        "number": 2,
        "biblical_verses": [
          2
        ],
        "lines": [
          "My thirsty soul longs veh’mently,",
          "yea faints, thy courts to see:",
          "My very heart and flesh cry out,",
          "O living God, for thee."
        ]
      },
      {
        "number": 3,
        "biblical_verses": [
          3
        ],
        "lines": [
          "Behold, the sparrow findeth out",
          "an house wherein to rest;",
          "The swallow also for herself",
          "hath purchasèd a nest;"
        ]
      },
      {
        "number": 4,
        "biblical_verses": [
          3
        ],
        "lines": [
          "Ev’n thine own altars, where she safe",
          "her young ones forth may bring,",
          "O thou almighty LORD of hosts,",
          "who art my God and King."
        ]
      },
      {
        "number": 5,
        "biblical_verses": [
          4,
          5
        ],
        "lines": [
          "Bless’d are they in thy house that dwell,",
          "they ever give thee praise.",
          "Bless’d is the man whose strength thou art,",
          "in whose heart are thy ways:"
        ]
      },
      {
        "number": 6,
        "biblical_verses": [
          6
        ],
        "lines": [
          "Who passing thorough Baca’s vale,",
          "therein do dig up wells;",
          "Also the rain that falleth down",
          "the pools with water fills."
        ]
      },
      {
        "number": 7,
        "biblical_verses": [
          7
        ],
        "lines": [
          "So they from strength unwearied go",
          "still forward unto strength,",
          "Until in Zion they appear",
          "before the Lord at length."
        ]
      },
      {
        "number": 8,
        "biblical_verses": [
          8,
          9
        ],
        "lines": [
          "LORD God of hosts, my prayèr hear;",
          "O Jacob’s God, give ear.",
          "See God our shield, look on the face",
          "of thine anointed dear."
        ]
      },
      {
        "number": 9,
        "biblical_verses": [
          10
        ],
        "lines": [
          "For in thy courts one day excels",
          "a thousand; rather in",
          "My God’s house will I keep a door,",
          "than dwell in tents of sin."
        ]
      },
      {
        "number": 10,
        "biblical_verses": [
          11
        ],
        "lines": [
          "For God the LORD’s a sun and shield:",
          "he’ll grace and glory give;",
          "And will withhold no good from them",
          "that uprightly do live."
        ]
      },
      {
        "number": 11,
        "biblical_verses": [
          12
        ],
        "lines": [
          "O thou that art the LORD of hosts,",
          "that man is truly blessed,",
          "Who by assured confidence",
          "on thee alone doth rest."
        ]
      }
    ]
  },
  {
    "psalm_number": 93,
    "source_version": "single version",
    "meter": {
      "pattern": "8.6.8.6",
      "name": "Common Meter"
    },
    "source_pages": {
      "printed_pages": "133",
      "pdf_zero_based_pages": "132"
    },
    "archive_member": "Scottish Psalter/Scottish-Psalter-093-(T) [C.M.].txt",
    "stanzas": [
      {
        "number": 1,
        "biblical_verses": [
          1
        ],
        "lines": [
          "The LORD doth reign, and clothed is he",
          "with majesty most bright;",
          "His works do show him clothed to be,",
          "and girt about with might."
        ]
      },
      {
        "number": 2,
        "biblical_verses": [
          1,
          2
        ],
        "lines": [
          "The world is also stablishèd,",
          "that it cannot depart.",
          "Thy throne is fixed of old, and thou",
          "from everlasting art."
        ]
      },
      {
        "number": 3,
        "biblical_verses": [
          3
        ],
        "lines": [
          "The floods, O LORD, have lifted up,",
          "they lifted up their voice;",
          "The floods have lifted up their waves,",
          "and made a mighty noise."
        ]
      },
      {
        "number": 4,
        "biblical_verses": [
          4
        ],
        "lines": [
          "But yet the LORD, that is on high,",
          "is more of might by far",
          "Than noise of many waters is,",
          "or great sea-billows are."
        ]
      },
      {
        "number": 5,
        "biblical_verses": [
          5
        ],
        "lines": [
          "Thy testimonies every one",
          "in faithfulness excel;",
          "And holiness for ever, LORD,",
          "thine house becometh well."
        ]
      }
    ]
  },
  {
    "psalm_number": 98,
    "source_version": "single version",
    "meter": {
      "pattern": "8.6.8.6",
      "name": "Common Meter"
    },
    "source_pages": {
      "printed_pages": "138",
      "pdf_zero_based_pages": "137"
    },
    "archive_member": "Scottish Psalter/Scottish-Psalter-098-(T) [C.M.].txt",
    "stanzas": [
      {
        "number": 1,
        "biblical_verses": [
          1
        ],
        "lines": [
          "O sing a new song to the LORD,",
          "for wonders he hath done:",
          "His right hand and his holy arm",
          "him victory hath won."
        ]
      },
      {
        "number": 2,
        "biblical_verses": [
          2
        ],
        "lines": [
          "The LORD God his salvätion",
          "hath causèd to be known;",
          "His justice in the heathen’s sight",
          "he openly hath shown."
        ]
      },
      {
        "number": 3,
        "biblical_verses": [
          3
        ],
        "lines": [
          "He mindful of his grace and truth",
          "to Isr’el’s house hath been;",
          "And the salvation of our God",
          "all ends of th’ earth have seen."
        ]
      },
      {
        "number": 4,
        "biblical_verses": [
          4
        ],
        "lines": [
          "Let all the earth unto the LORD",
          "send forth a joyful noise;",
          "Lift up your voice aloud to him,",
          "sing praises, and rejoice."
        ]
      },
      {
        "number": 5,
        "biblical_verses": [
          5,
          6
        ],
        "lines": [
          "With harp, with harp, and voice of psalms,",
          "unto JEHOVAH sing:",
          "With trumpets, cornets, gladly sound",
          "before the LORD the King."
        ]
      },
      {
        "number": 6,
        "biblical_verses": [
          7,
          8
        ],
        "lines": [
          "Let seas and all their fulness roar;",
          "the world, and dwellers there;",
          "Let floods clap hands, and let the hills",
          "together joy declare"
        ]
      },
      {
        "number": 7,
        "biblical_verses": [
          9
        ],
        "lines": [
          "Before the LORD; because he comes,",
          "to judge the earth comes he:",
          "He’ll judge the world with righteousness,",
          "his folk with equity."
        ]
      }
    ]
  },
  {
    "psalm_number": 117,
    "source_version": "single version",
    "meter": {
      "pattern": "8.6.8.6",
      "name": "Common Meter"
    },
    "source_pages": {
      "printed_pages": "168",
      "pdf_zero_based_pages": "167"
    },
    "archive_member": "Scottish Psalter/Scottish-Psalter-117-(T) [C.M.].txt",
    "stanzas": [
      {
        "number": 1,
        "biblical_verses": [
          1
        ],
        "lines": [
          "O give ye praise unto the LORD,",
          "all nätions that be;",
          "Likewise, ye people all, accord",
          "his name to magnify."
        ]
      },
      {
        "number": 2,
        "biblical_verses": [
          2
        ],
        "lines": [
          "For great to us-ward ever are",
          "his loving-kindnesses:",
          "His truth endures for evermore.",
          "The LORD O do ye bless."
        ]
      }
    ]
  },
  {
    "psalm_number": 121,
    "source_version": "single version",
    "meter": {
      "pattern": "8.6.8.6",
      "name": "Common Meter"
    },
    "source_pages": {
      "printed_pages": "183",
      "pdf_zero_based_pages": "182"
    },
    "archive_member": "Scottish Psalter/Scottish-Psalter-121-(T) [C.M.].txt",
    "stanzas": [
      {
        "number": 1,
        "biblical_verses": [
          1,
          2
        ],
        "lines": [
          "I to the hills will lift mine eyes,",
          "from whence doth come mine aid.",
          "My safety cometh from the LORD,",
          "who heav’n and earth hath made."
        ]
      },
      {
        "number": 2,
        "biblical_verses": [
          3,
          4
        ],
        "lines": [
          "Thy foot he’ll not let slide, nor will",
          "he slumber that thee keeps.",
          "Behold, he that keeps Israel,",
          "he slumbers not, nor sleeps."
        ]
      },
      {
        "number": 3,
        "biblical_verses": [
          5,
          6
        ],
        "lines": [
          "The LORD thee keeps, the LORD thy shade",
          "on thy right hand doth stay:",
          "The moon by night thee shall not smite,",
          "nor yet the sun by day."
        ]
      },
      {
        "number": 4,
        "biblical_verses": [
          7,
          8
        ],
        "lines": [
          "The LORD shall keep thy soul; he shall",
          "preserve thee from all ill.",
          "Henceforth thy going out and in",
          "GOD keep for ever will."
        ]
      }
    ]
  },
  {
    "psalm_number": 130,
    "source_version": "single version",
    "meter": {
      "pattern": "8.6.8.6",
      "name": "Common Meter"
    },
    "source_pages": {
      "printed_pages": "188",
      "pdf_zero_based_pages": "187"
    },
    "archive_member": "Scottish Psalter/Scottish-Psalter-130-(T) [C.M.].txt",
    "stanzas": [
      {
        "number": 1,
        "biblical_verses": [
          1,
          2
        ],
        "lines": [
          "LORD, from the depths to thee I cried.",
          "My voice, Lord, do thou hear:",
          "Unto my supplications’ voice",
          "give an attentive ear."
        ]
      },
      {
        "number": 2,
        "biblical_verses": [
          3,
          4
        ],
        "lines": [
          "Lord, who shall stand, if thou, O LORD,",
          "should’st mark iniquity?",
          "But yet with thee forgiveness is,",
          "that fear’d thou mayest be."
        ]
      },
      {
        "number": 3,
        "biblical_verses": [
          5,
          6
        ],
        "lines": [
          "I wait for GOD, my soul doth wait,",
          "my hope is in his word.",
          "More than they that for morning watch,",
          "my soul waits for the Lord;"
        ]
      },
      {
        "number": 4,
        "biblical_verses": [
          6,
          7
        ],
        "lines": [
          "I say, more than they that do watch",
          "the morning light to see.",
          "Let Israèl hope in the LORD,",
          "for with him mercies be;"
        ]
      },
      {
        "number": 5,
        "biblical_verses": [
          7,
          8
        ],
        "lines": [
          "And plenteous redëmption",
          "is ever found with him.",
          "And from all his iniquities",
          "he Isr’el shall redeem."
        ]
      }
    ]
  },
  {
    "psalm_number": 133,
    "source_version": "single version",
    "meter": {
      "pattern": "8.6.8.6",
      "name": "Common Meter"
    },
    "source_pages": {
      "printed_pages": "190",
      "pdf_zero_based_pages": "189"
    },
    "archive_member": "Scottish Psalter/Scottish-Psalter-133-(T) [C.M.].txt",
    "stanzas": [
      {
        "number": 1,
        "biblical_verses": [
          1
        ],
        "lines": [
          "Behold, how good a thing it is,",
          "and how becoming well,",
          "Together such as brethren are",
          "in unity to dwell!"
        ]
      },
      {
        "number": 2,
        "biblical_verses": [
          2
        ],
        "lines": [
          "Like precious ointment on the head,",
          "that down the beard did flow,",
          "Ev’n Aaron’s beard, and to the skirts",
          "did of his garments go."
        ]
      },
      {
        "number": 3,
        "biblical_verses": [
          3
        ],
        "lines": [
          "As Hermon’s dew, the dew that doth",
          "on Zion hills descend:",
          "For there the blessing GOD commands,",
          "life that shall never end."
        ]
      }
    ]
  },
  {
    "psalm_number": 150,
    "source_version": "single version",
    "meter": {
      "pattern": "8.6.8.6",
      "name": "Common Meter"
    },
    "source_pages": {
      "printed_pages": "212",
      "pdf_zero_based_pages": "211"
    },
    "archive_member": "Scottish Psalter/Scottish-Psalter-150-(T) [C.M.].txt",
    "stanzas": [
      {
        "number": 1,
        "biblical_verses": [
          1
        ],
        "lines": [
          "Praise ye the LORD. God’s praise within",
          "his sanctuary raise;",
          "And to him in the firmament",
          "of his pow’r give ye praise."
        ]
      },
      {
        "number": 2,
        "biblical_verses": [
          2
        ],
        "lines": [
          "Because of all his mighty acts,",
          "with praise him magnify:",
          "O praise him, as he doth excel",
          "in glorious majesty."
        ]
      },
      {
        "number": 3,
        "biblical_verses": [
          3,
          4
        ],
        "lines": [
          "Praise him with trumpet’s sound; his praise",
          "with psaltery advance:",
          "With timbrel, harp, stringed instruments,",
          "and organs, in the dance."
        ]
      },
      {
        "number": 4,
        "biblical_verses": [
          5,
          6
        ],
        "lines": [
          "Praise him on cymbals loud; him praise",
          "on cymbals sounding high.",
          "Let each thing breathing praise the LORD.",
          "Praise to the LORD give ye."
        ]
      }
    ]
  }
];
const outputDirectory = new URL("../corpus/text/", import.meta.url);
const facsimileUrl =
  "https://freechurch.org/wp-content/uploads/2026/05/Scottish-Psalter-Words-Only-Digital-Edition.pdf";
const sourceNote =
  "Received text transcribed from the Free Church of Scotland words-only digital edition; diplomatic collation against a 1650 witness remains pending.";

function pad(value) {
  return String(value).padStart(3, "0");
}

function sourcePageLabel(source) {
  const title =
    source.source_version === "first version"
      ? "Psalm " + source.psalm_number + ", first version"
      : "Psalm " + source.psalm_number;
  const printed = source.source_pages.printed_pages;
  const pdf = source.source_pages.pdf_zero_based_pages;
  const printedPrefix = printed.includes("-") ? "pp. " : "p. ";
  const pdfPrefix = pdf.includes("-") ? "PDF pp. " : "PDF p. ";

  return (
    title +
    " · " +
    printedPrefix +
    printed.replace("-", "–") +
    " (" +
    pdfPrefix +
    pdf.replace("-", "–") +
    ")"
  );
}

function makeReadingText(text) {
  return text
    .replace(/\bth’\s+/gu, "th’")
    .replace(/\s+(’(?:s|lt))\b/gu, "$1");
}

function makeRecord(source) {
  const psalmId = "ps1650.psalm-" + pad(source.psalm_number) + ".primary";
  const meterCounts = source.meter.pattern.split(".").map(Number);
  const firstLine = source.stanzas[0].lines[0];

  return {
    $schema: "../schemas/psalm.schema.json",
    schema_version: "0.1.0",
    id: psalmId,
    psalm_number: source.psalm_number,
    title: "Psalm " + source.psalm_number,
    version: "primary",
    opening_line: firstLine.replace(/[,:;.!?]+$/u, ""),
    meter: source.meter,
    editorial_status: "prototype",
    edition_status: {
      diplomatic: "uncollated",
      normalized: "provisional",
      reading: "generated-preview",
    },
    source: {
      witness_id: "fcos.received-text-2026",
      page_label: sourcePageLabel(source),
      facsimile_url: facsimileUrl,
      note: sourceNote,
    },
    verification: {
      required_reviews: 2,
      completed_reviews: 0,
      state: "awaiting-verification",
    },
    rights: {
      historic_text: "PDM-1.0",
      transcription: "CC0-1.0",
      metadata: "CC0-1.0",
    },
    stanzas: source.stanzas.map((stanza, stanzaIndex) => {
      const stanzaNumber = stanzaIndex + 1;
      const stanzaId =
        psalmId + ".stanza-" + String(stanzaNumber).padStart(2, "0");

      return {
        id: stanzaId,
        number: stanzaNumber,
        biblical_verses: stanza.biblical_verses,
        lines: stanza.lines.map((text, lineIndex) => {
          const lineNumber = lineIndex + 1;

          return {
            id:
              stanzaId +
              ".line-" +
              String(lineNumber).padStart(2, "0"),
            number: lineNumber,
            syllable_count: meterCounts[lineIndex],
            text: {
              diplomatic: text,
              normalized: text,
              reading: makeReadingText(text),
            },
          };
        }),
      };
    }),
  };
}

await mkdir(outputDirectory, { recursive: true });

for (const source of sourceRecords) {
  const fileName = "psalm-" + pad(source.psalm_number) + ".primary.json";
  const record = makeRecord(source);
  await writeFile(
    new URL(fileName, outputDirectory),
    JSON.stringify(record, null, 2) + "\n",
    "utf8",
  );
}

console.log(
  "Seeded " +
    sourceRecords.length +
    " received-text Psalm records from the Free Church of Scotland source.",
);
