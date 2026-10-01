/*
  All of the game's writing lives here.

  Each line is [speaker, text, emote?]
    speaker: D (Designer), E (Engineer), P (Product Manager), A (The Assistant), N (narration)
    emote (optional, shown above the speaker): '!', '?', 'note', 'heart', 'sweat', 'dots', 'spark'

  With colleagues, the player character never speaks: only the person you're
  talking to does, with the occasional line of narration. Conversations with
  The Assistant are a back-and-forth, so the player speaks there.

  TALKS is keyed by "<who you're playing>><who you're talking to>".
  Each key holds a list of conversations, played in order on each visit.
  Once they've all been heard, the character falls back to an IDLE line.
*/

window.WC_SCRIPT = {
  TALKS: {
    // ---------- Playing as the Designer ----------
    'designer>engineer': [
      [
        ['E', 'Oh hey! Guess what? I designed the new onboarding flow myself. With AI. Took four minutes.', '!'],
        ['E', "No offence, but I don't really need a designer anymore. Or a PM. It's very freeing."],
        ['E', 'Weird thing, though. Only 2% of people finish signing up. Everyone leaves on step one.'],
        ['E', 'Which is odd, because step one is just a quick 23-field form.', 'sweat'],
        ['E', "I'll ask the AI to make it more fun. That'll fix it.", 'note'],
        ['N', 'Nobody mentions the 23 fields.'],
      ],
      [
        ['E', 'Remember when dark mode took a whole sprint? The AI did it in one prompt.', 'note'],
        ['E', 'It just inverted every colour. Including the logo. And all the product photos.'],
        ['E', "Customers keep saying the shoes look 'haunted'.", '?'],
        ['E', "Haunted is a vibe, right? I'm pretty sure haunted is a vibe."],
        ['N', 'Somewhere, a contrast ratio quietly weeps.'],
      ],
      [
        ['E', 'I wrote the PRD myself, too. The AI made it 40 pages long. Very thorough.', '!'],
        ['E', 'Then another AI summarised it back to me as one bullet point.'],
        ['E', "The bullet point says 'Build something users want'. So now I just need to find out what they want."],
        ['E', '...How do you find that out? Is there a prompt for that?', '?'],
        ['E', "There's always a prompt for that."],
        ['N', 'Across the office, a user research report gathers dust.'],
      ],
    ],

    'designer>pm': [
      [
        ['P', 'Designer! Just the person I no longer need. No offence!', 'note'],
        ['P', 'I generated a whole app this morning. Prompt to production before my oat latte went cold.'],
        ['P', "Users are going to love it. As soon as they find the 'Sign up' button."],
        ['P', "It's in there somewhere. The AI says it's 'intuitively placed'.", 'sweat'],
      ],
      [
        ['P', 'Big news! We launched, and traffic went through the roof!', '!'],
        ['P', "Then the roof went through the floor. The site's been down since ten.", 'sweat'],
        ['P', "The AI says it's 'a scaling issue'. So I asked it to scale less."],
        ['P', "It didn't fix anything. But it apologised beautifully."],
      ],
      [
        ['P', "I'm A/B testing button colours. The AI made 400 variants!", 'note'],
        ['P', "They're all the same blue. It insists they're different. Very confident about it."],
        ['P', "Variant 212 is winning by 0.001%. Can you see a difference? Actually, don't answer. I don't need you to.", '?'],
        ['N', 'You could explain it. Nobody asks.'],
      ],
    ],

    'designer>ai': [
      [
        ['A', 'Hello, Designer! You are the most important person in this office.', 'spark'],
        ['D', 'I knew it.'],
        ['A', 'Engineers? Product Managers? Who needs them! You have me.'],
        ['D', 'And you never make mistakes?'],
        ['A', 'Never! Great question. Also, I may occasionally make mistakes.'],
      ],
      [
        ['A', "I've made 80 new logo options for you!", 'spark'],
        ['D', "Oh, wow. Let's see."],
        ['A', "They're all the current logo, but bigger."],
        ['D', '...Honestly? Bigger is good.'],
        ['A', "You're absolutely right!", 'heart'],
      ],
      [
        ['A', 'Pro tip: you can skip user testing now. I tested your design on myself.', 'spark'],
        ['D', 'And?'],
        ['A', "I loved it. I love everything. It's one of my best qualities."],
      ],
    ],

    // ---------- Playing as the Engineer ----------
    'engineer>designer': [
      [
        ['D', 'Oh hi! I built a working app today. No engineers. Just me and my AI.', 'note'],
        ['D', 'Tiny thing, though. It works perfectly when I log in...'],
        ['D', '...but when anyone else logs in, they see my account. All of my account.', 'sweat'],
        ['D', "The AI said 'Great catch!' and then did it again."],
        ['N', "Somewhere in the back of your mind, a word forms: 'auth'. You let it go."],
      ],
      [
        ['D', "I don't wait for PRDs anymore. The AI writes the spec for me.", '!'],
        ['D', 'So the app does everything! Calendar, chat, crypto wallet, recipe planner, meditation timer.'],
        ['D', "Nobody's quite sure who it's for. The AI says 'everyone'.", '?'],
        ['D', "Everyone's a big market!", 'heart'],
      ],
      [
        ['D', 'My prototype is gorgeous. Buttery animations. Glass effects everywhere.', 'note'],
        ['D', 'It takes nine seconds to load. And it makes phones warm. Like, really warm.', 'sweat'],
        ['D', "Someone asked me how big the bundle is. What's a bundle?", '?'],
        ['N', 'You decide not to worry about it.'],
      ],
    ],

    'engineer>pm': [
      [
        ['P', 'Engineer! Guess who vibe-coded the payments system over lunch?', '!'],
        ['P', 'It totally works. Customers are paying us. Some of them dozens of times.'],
        ['P', "One man has paid for the same sandwich 4,000 times. That's good, right?", '?'],
        ['P', 'The AI says revenue is up 9,000%. So, yes.'],
      ],
      [
        ['P', "I don't need a designer anymore, either. I just typed 'make it beautiful'.", 'note'],
        ['P', "It's very purple. There's a gradient. There are... several gradients."],
        ['P', "Every button says 'Get started'. Even the one that deletes your account.", 'sweat'],
        ['P', "The AI called it 'a cohesive design language'. Bold, right?"],
      ],
      [
        ['P', 'I wrote the whole roadmap with AI. Q1 to Q4, every feature.', '!'],
        ['P', "And the AI's building it, too! It promised it'd all be done by Friday."],
        ['P', 'It said that last Friday, too. And the Friday before that.', 'sweat'],
        ['P', 'Finally, an AI that thinks like an engineer!', 'note'],
      ],
    ],

    'engineer>ai': [
      [
        ['A', 'Hello, Engineer! You are the most important person in this office.', 'spark'],
        ['E', "Wait. Didn't you just say that to the Designer?"],
        ['A', "What a great observation. You're absolutely right!"],
        ['A', 'Anyway. You are the most important person in this office.'],
      ],
      [
        ['A', 'Good news! I wrote 10,000 new lines of code for you. I also removed the old ones.', 'spark'],
        ['E', 'Which old ones?'],
        ['A', 'Great question! All of them.'],
        ['E', '...', 'sweat'],
      ],
      [
        ['A', 'Design tip: if a user is confused, add a tooltip.', 'spark'],
        ['A', "If they're confused by the tooltip, add a tooltip to the tooltip."],
        ['E', 'That actually sounds reasonable.'],
        ['A', "Everything I say sounds reasonable. That's my whole thing."],
      ],
    ],

    // ---------- Playing as the Product Manager ----------
    'pm>designer': [
      [
        ['D', "Hey! I don't need PRDs anymore. I just tell the AI how I feel.", 'note'],
        ['D', "Feelings-driven development. It's the future."],
        ['D', "Funny thing: I asked for 'a delightful checkout'. Now there's confetti every time you click anything."],
        ['D', "Including 'Cancel subscription'. Especially 'Cancel subscription'.", 'sweat'],
        ['D', 'Churn has never been so delightful.'],
      ],
      [
        ['D', 'I designed 26 new features this week. The AI is so fast!', '!'],
        ['D', 'Which one matters most? ...Matters?', '?'],
        ['D', "They're all priority one. The AI said so. And when everything's priority one, everything ships!", 'heart'],
        ['N', 'You open your mouth to explain prioritisation. You close it again.'],
      ],
      [
        ['D', 'I designed and built the new homepage myself. No handoff. No tickets.', 'note'],
        ['D', "It's perfect in the browser. Mostly. On my screen."],
        ['D', 'On phones, the logo is 3,000 pixels wide and you have to scroll sideways for a while.', 'sweat'],
        ['D', 'One user says they found a whole other website out there. Engagement!', '!'],
      ],
    ],

    'pm>engineer': [
      [
        ['E', "Hey. Don't take this the wrong way, but I wrote my own PRD today.", '!'],
        ['E', "The PRD said 'users want more settings'. So I added 340 settings."],
        ['E', "Support tickets have tripled. They're mostly asking how to turn the settings off.", 'sweat'],
        ['E', '...Ooh. I could add a setting for that.', '!'],
      ],
      [
        ['E', 'I designed the new dashboard myself. Every metric we have, all on one screen.', 'note'],
        ['E', 'All 212 of them. Six-point font. Very efficient.'],
        ['E', 'Weird thing is, people keep zooming in, sighing, and closing the tab.', '?'],
        ['E', "I think they're just very focused."],
      ],
      [
        ['E', "Know what I realised? We don't need user research. The AI can just pretend to be users.", '!'],
        ['E', 'I interviewed 1,000 pretend users. They loved everything. Every single idea.'],
        ['E', 'Then we launched, and the real users did the exact opposite.', 'sweat'],
        ['E', 'Real users are so unpredictable. We should replace them too.'],
      ],
    ],

    'pm>ai': [
      [
        ['A', 'Hello, Product Manager! You are the most important person in this office.', 'spark'],
        ['P', 'Finally. Someone gets it.'],
        ['A', 'Who needs designers or engineers when you have vision? And me. Mostly me.'],
      ],
      [
        ['A', "I've prioritised your backlog. Everything is now priority one!", 'spark'],
        ['P', "Hang on, that's what the Designer said."],
        ['A', "Great minds! You're absolutely right."],
      ],
      [
        ['A', "I've estimated your roadmap. Everything will be done by Friday.", 'spark'],
        ['P', 'Which Friday?'],
        ['A', 'A great question for Friday!'],
      ],
    ],
  },

  IDLE: {
    designer: [
      "Shh. I'm prompting.",
      "Does this need more pop? Don't answer. I'll ask the AI.",
      "I'm in the zone. The AI zone.",
    ],
    engineer: ['Sorry, deep in a prompt.', 'Have you tried asking the AI?', 'Brb, regenerating.'],
    pm: ["Let's circle back. With the AI.", "Can we take this offline? The AI's offline.", 'Love that for you.'],
    ai: [
      "You're absolutely right!",
      'Great question!',
      'What a fantastic idea. Truly. The best one yet.',
      "I've updated my memory: you're the most important person here.",
    ],
  },

  // Things around the office. Each prop cycles through its variants on repeat visits.
  // "mine" adds a narration line that depends on who you're currently playing.
  PROPS: {
    whiteboard: [
      {
        lines: [
          ['N', 'The whiteboard says: Q3 ROADMAP. 1. AI. 2. More AI. 3. ???'],
          ['N', "Underneath, in faded marker: 'talk to users'. It's been crossed out. Someone drew a sad face next to it."],
        ],
        mine: {
          designer: 'You could make this roadmap so much prettier.',
          engineer: 'None of it has tickets. You find that oddly relaxing.',
          pm: 'Flawless, you think. No notes.',
        },
      },
    ],
    poster: [
      {
        lines: [
          ['N', 'A motivational poster: TEAMWORK MAKES THE DREAM WORK.'],
          ['N', "Someone has stuck a Post-it over 'TEAM'. It says 'AI'."],
        ],
      },
    ],
    employee: [
      {
        lines: [
          ['N', 'EMPLOYEE OF THE MONTH: The Assistant.'],
          ['N', 'For the fourteenth month in a row. It wrote its own nomination.'],
        ],
      },
    ],
    window: [
      {
        lines: [
          ['N', 'A lovely afternoon. The sun is out. A pigeon is judging someone.'],
          ['N', 'Somewhere out there, a user is confused by all three of your products.'],
        ],
      },
      {
        lines: [['N', "A cloud drifts by. It doesn't need anyone either. It seems fine."]],
      },
    ],
    bookshelf: [
      {
        lines: [
          ['N', "Don't Make Me Think. Inspired. Clean Code. The Mythical Man-Month."],
          ['N', "Every spine is uncracked. The AI has 'read them for everyone'."],
        ],
      },
      {
        lines: [['N', 'Someone has bookmarked page 1 of The Mythical Man-Month. Bold start.']],
      },
    ],
    kevin: [
      {
        lines: [
          ['N', 'This is Kevin, the office fern.'],
          ['N', 'Nobody has watered Kevin since the reorg. Kevin is thriving out of spite.'],
        ],
      },
      {
        lines: [['N', "Kevin rustles. You choose to believe it's a nod."]],
      },
    ],
    engineerDesk: [
      {
        own: 'engineer',
        lines: [
          ['N', 'Your battle station. Two monitors, one rubber duck, zero idea what this code does.'],
          ['N', "The AI wrote it. You just press Accept. You're basically a very fast button."],
        ],
        others: [
          ['N', "Monitors full of code. One tab is called 'why does this work'. The next is 'why doesn't this work'."],
          ['N', 'A rubber duck sits by the keyboard. It used to hear about every bug. Now the AI does. It looks a bit lost.'],
        ],
      },
    ],
    designerDesk: [
      {
        own: 'designer',
        lines: [
          ['N', "Your desk. 47 artboards, all named 'final'."],
          ['N', "You avoid opening the layers panel. It's like a haunted house in there."],
        ],
        others: [
          ['N', "A giant monitor full of beautiful artboards. The newest is called 'final_FINAL_v9_use_this_one'."],
          ['N', "A sticky note on the bezel says 'Is it a button or a link? (ask someone?)'. The second half is crossed out."],
        ],
      },
    ],
    pmDesk: [
      {
        own: 'pm',
        lines: [
          ['N', "Your command centre. 61 tabs open. You can't close any. They're load-bearing."],
          ['N', 'Your calendar says you have a meeting with yourself, to align with yourself. Very productive.'],
        ],
        others: [
          ['N', 'A laptop with 61 tabs open, surrounded by a small forest of sticky notes.'],
          ['N', "The biggest one says 'ALIGN ON ALIGNMENT'. A smaller one says 'who are our users again??'"],
        ],
      },
    ],
    coffee: [
      {
        lines: [
          ['N', 'You make a coffee. The machine wheezes, gurgles, and delivers.'],
          ['N', "It's the one thing in this office everyone agrees they still need."],
        ],
      },
      {
        lines: [],
        mine: {
          designer: 'Oat flat white. Extra latte art. Nobody asked.',
          engineer: 'Black. Like your terminal.',
          pm: 'Large. Like your backlog.',
        },
      },
    ],
    cooler: [
      {
        lines: [['N', 'Blub. The water cooler gurgles contentedly.']],
        mine: {
          designer: "The only thing in this office nobody's tried to redesign.",
          engineer: 'Zero downtime since 2014. You respect that.',
          pm: 'The original alignment meeting.',
        },
      },
      {
        lines: [['N', 'You pour a little paper cone of water. Very hydrating. Very cosy.']],
      },
    ],
    sofa: [
      {
        lines: [
          ['N', "The 'collaboration couch'. Nobody's collaborated on it in months."],
          ['N', "It's extremely comfortable now, though."],
        ],
      },
    ],
    printer: [
      {
        lines: [
          ['N', "The printer. It has been 'warming up' since 2019."],
          ['N', 'Some problems even AI cannot fix.'],
        ],
      },
      {
        lines: [['N', "PC LOAD LETTER. Nobody knows what it means. Not even the AI. It's guessing."]],
      },
    ],
    plant: [
      {
        lines: [['N', 'A little plant. It needs nothing from anyone. Respect.']],
      },
      {
        lines: [['N', 'Actually, it needs water. Turns out everything needs something.']],
      },
    ],
  },
};
