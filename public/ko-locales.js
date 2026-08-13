/* LetterBrick Korean MVP locales
   en = English speakers, es = Spanish speakers, zh = Simplified Chinese speakers */
(function() {
  const common = {
    en: {
      name: 'English',
      switchLabel: 'Language',
      navHome: 'LetterBrick home',
      back: 'Back',
      progress: 'Progress',
      dayWeek: (day, week) => `Day ${day} · Week ${week}`,
      progressText: (day) => `Progress: Day ${day} / 56`,
      compactProgressText: (day) => `Day ${day}/56`,
      step1Eyebrow: (day) => `Today’s sentence · Day ${day}`,
      step1Title: 'Today’s Sentence',
      step1Sub: 'Meet the Korean sentence for today',
      translationLabel: 'English translation',
      reveal: '👁 Reveal',
      hide: '🙈 Hide',
      listen: 'Listen',
      playing: 'Playing...',
      audioNotSupported: 'Audio is not available in this browser yet.',
      readNext: 'I’ve read it →',
      step2Title: 'Copy It',
      step2Sub: 'Transcription — copy it carefully',
      copyInstruction: 'Copy the sentence carefully. Feel each character as you write. Notice the rhythm and spacing.',
      referenceHide: 'Hide',
      referenceShow: 'Show',
      startTyping: 'Start typing above...',
      perfect: '✓ Perfect match!',
      keepGoing: (pct) => `${pct}% — keep going…`,
      typing: '⌨ Typing',
      handwriting: '✍ Handwriting',
      handwritingSoon: '(handwriting mode — photo upload coming soon)',
      keyboardHelpTitle: 'No Korean keyboard yet?',
      keyboardHelp: 'You can still preview the lesson. For the full practice, add Korean input on your phone or computer, then come back and copy the sentence exactly.',
      skipCopy: 'Continue preview →',
      next: 'Next →',
      step3Title: 'See the Structure',
      step3Sub: 'Let’s understand the pattern',
      tryLater: 'Try it yourself later: swap the first phrase for another time, place, or feeling.',
      gotIt: 'Got it →',
      step4Title: 'Key Vocabulary',
      step4Sub: 'Tap each card to flip',
      tapToFlip: 'TAP TO FLIP ↻',
      markLearned: 'Mark learned',
      learned: '✓ Learned',
      learnedProgress: (done, total) => `${done} / ${total} marked learned`,
      continue: 'Continue →',
      step5Title: 'Variations',
      step5Sub: 'Three ways to say it differently',
      badges: { casual: 'Conversational', formal: 'Formal', kdrama: 'K-drama' },
      difference: 'I see the difference →',
      step6Title: 'Make Your Own',
      step6Sub: 'Now write your sentence',
      promptLabel: 'Today’s structure',
      promptText: 'Use today’s structure:',
      promptPattern: '[When ___], [something] comes to mind.',
      promptHint: 'Try: 봄이 오면... (When spring comes...) · 음악을 들으면... (When I listen to music...)',
      charUnit: 'chars',
      feedback: 'Get feedback →',
      complete: 'Complete ✓',
      emptyFeedback: 'Write something first — even a fragment is great.',
      strongFeedback: 'Your sentence uses today’s structure beautifully — a “when” condition followed by a feeling or memory. The pattern is becoming yours. 잘했어요!',
      conditionalFeedback: 'Nice use of a conditional — you set the scene well. Try adding what comes to mind or how you feel in that moment.',
      koreanFeedback: 'Good start with Korean characters! Try opening with a “when” phrase like 봄이 오면... to use today’s structure fully.',
      nonKoreanFeedback: 'It looks like you wrote in another language — try writing in Korean. Even simple words work.',
      completionTitle: 'Today’s brick is complete!',
      completionSubtitle: (day) => `Day ${day} complete — great work today`,
      brickUnit: 'bricks',
      brickTotal: 'Total',
      completionSentenceLabel: 'Today’s sentence',
      share: 'Share today’s sentence',
      tomorrow: (day) => `Tomorrow · Day ${day}`,
      seeTomorrow: 'See you tomorrow →',
      curriculumComplete: 'Curriculum complete!',
      copied: 'Copied to clipboard!',
      shareText: (day, ko, translation) => `Day ${day} · LetterBrick Korean\n\n${ko}\n“${translation}”\n\n#LetterBrick #LearnKorean #한국어`
    },
    es: {
      name: 'Español',
      switchLabel: 'Idioma',
      navHome: 'Inicio de LetterBrick',
      back: 'Atrás',
      progress: 'Progreso',
      dayWeek: (day, week) => `Día ${day} · Semana ${week}`,
      progressText: (day) => `Progreso: Día ${day} / 56`,
      compactProgressText: (day) => `Día ${day}/56`,
      step1Eyebrow: (day) => `Frase de hoy · Día ${day}`,
      step1Title: 'Frase de Hoy',
      step1Sub: 'Conoce la frase coreana que aprenderás hoy',
      translationLabel: 'Traducción al español',
      reveal: '👁 Ver',
      hide: '🙈 Ocultar',
      listen: 'Escuchar',
      playing: 'Reproduciendo...',
      audioNotSupported: 'El audio aún no está disponible en este navegador.',
      readNext: 'Ya la leí →',
      step2Title: 'Cópiala',
      step2Sub: 'Transcripción — escríbela con cuidado',
      copyInstruction: 'Copia la frase con calma. Observa cada carácter, el ritmo y los espacios.',
      referenceHide: 'Ocultar',
      referenceShow: 'Mostrar',
      startTyping: 'Empieza a escribir arriba...',
      perfect: '✓ ¡Coincide perfecto!',
      keepGoing: (pct) => `${pct}% — sigue un poco más…`,
      typing: '⌨ Teclado',
      handwriting: '✍ A mano',
      handwritingSoon: '(modo manuscrito — subida de foto próximamente)',
      keyboardHelpTitle: '¿Aún no tienes teclado coreano?',
      keyboardHelp: 'Puedes previsualizar la lección. Para practicar completa, añade el teclado coreano en tu móvil u ordenador y vuelve a copiar la frase exacta.',
      skipCopy: 'Continuar vista previa →',
      next: 'Siguiente →',
      step3Title: 'Mira la Estructura',
      step3Sub: 'Entiende el patrón de la frase',
      tryLater: 'Luego pruébalo tú: cambia la primera parte por otro momento, lugar o sentimiento.',
      gotIt: 'Entendido →',
      step4Title: 'Vocabulario Clave',
      step4Sub: 'Toca cada tarjeta para voltearla',
      tapToFlip: 'TOCA PARA VOLTEAR ↻',
      markLearned: 'Marcar aprendido',
      learned: '✓ Aprendido',
      learnedProgress: (done, total) => `${done} / ${total} aprendidas`,
      continue: 'Continuar →',
      step5Title: 'Variaciones',
      step5Sub: 'Tres formas de decirlo distinto',
      badges: { casual: 'Conversacional', formal: 'Formal', kdrama: 'K-drama' },
      difference: 'Veo la diferencia →',
      step6Title: 'Haz tu Frase',
      step6Sub: 'Ahora escribe tu propia frase',
      promptLabel: 'Estructura de hoy',
      promptText: 'Usa la estructura de hoy:',
      promptPattern: '[Cuando ___], [algo] viene a la mente.',
      promptHint: 'Prueba: 봄이 오면... (Cuando llega la primavera...) · 음악을 들으면... (Cuando escucho música...)',
      charUnit: 'caracteres',
      feedback: 'Recibir feedback →',
      complete: 'Completar ✓',
      emptyFeedback: 'Primero escribe algo — incluso un fragmento sirve.',
      strongFeedback: 'Tu frase usa muy bien la estructura de hoy: una condición con “cuando” seguida de un sentimiento o recuerdo. El patrón ya empieza a ser tuyo. 잘했어요!',
      conditionalFeedback: 'Buen uso de la condición: abriste bien la escena. Ahora añade qué te viene a la mente o cómo te sientes.',
      koreanFeedback: 'Buen comienzo con caracteres coreanos. Intenta abrir con una frase como 봄이 오면... para usar toda la estructura.',
      nonKoreanFeedback: 'Parece que escribiste en otro idioma. Intenta escribir en coreano; incluso palabras simples sirven.',
      completionTitle: '¡El ladrillo de hoy está completo!',
      completionSubtitle: (day) => `Día ${day} completo — buen trabajo`,
      brickUnit: 'ladrillos',
      brickTotal: 'Total',
      completionSentenceLabel: 'Frase de hoy',
      share: 'Compartir la frase de hoy',
      tomorrow: (day) => `Mañana · Día ${day}`,
      seeTomorrow: 'Nos vemos mañana →',
      curriculumComplete: '¡Currículum completo!',
      copied: '¡Copiado al portapapeles!',
      shareText: (day, ko, translation) => `Día ${day} · LetterBrick Korean\n\n${ko}\n“${translation}”\n\n#LetterBrick #AprenderCoreano #한국어`
    },
    zh: {
      name: '中文',
      switchLabel: '语言',
      navHome: 'LetterBrick 首页',
      back: '返回',
      progress: '进度',
      dayWeek: (day, week) => `第 ${day} 天 · 第 ${week} 周`,
      progressText: (day) => `进度：第 ${day} / 56 天`,
      compactProgressText: (day) => `第 ${day}/56 天`,
      step1Eyebrow: (day) => `今日句子 · 第 ${day} 天`,
      step1Title: '今日句子',
      step1Sub: '先认识今天要学的韩语句子',
      translationLabel: '中文翻译',
      reveal: '👁 显示',
      hide: '🙈 隐藏',
      listen: '听一听',
      playing: '播放中...',
      audioNotSupported: '当前浏览器暂不支持播放音频。',
      readNext: '我读完了 →',
      step2Title: '抄写',
      step2Sub: '认真把句子打一遍',
      copyInstruction: '慢慢抄写这句话。注意每个字、节奏和空格。',
      referenceHide: '隐藏',
      referenceShow: '显示',
      startTyping: '在上方开始输入...',
      perfect: '✓ 完全正确！',
      keepGoing: (pct) => `${pct}% — 继续加油…`,
      typing: '⌨ 输入',
      handwriting: '✍ 手写',
      handwritingSoon: '（手写模式：照片上传即将推出）',
      keyboardHelpTitle: '还没有韩语键盘？',
      keyboardHelp: '你仍然可以先预览课程。完整练习时，请先在手机或电脑添加韩语输入法，再回来逐字抄写。',
      skipCopy: '继续预览 →',
      next: '下一步 →',
      step3Title: '看懂结构',
      step3Sub: '理解今天的句型',
      tryLater: '稍后可以自己替换开头，换成另一个时间、地点或心情。',
      gotIt: '明白了 →',
      step4Title: '核心词汇',
      step4Sub: '点击卡片翻面',
      tapToFlip: '点击翻面 ↻',
      markLearned: '标记已学',
      learned: '✓ 已学',
      learnedProgress: (done, total) => `${done} / ${total} 已标记`,
      continue: '继续 →',
      step5Title: '相似表达',
      step5Sub: '三种不同说法',
      badges: { casual: '口语', formal: '正式', kdrama: '韩剧感' },
      difference: '我看懂差别了 →',
      step6Title: '写出你的句子',
      step6Sub: '现在用韩语写一句自己的话',
      promptLabel: '今日结构',
      promptText: '使用今天的结构：',
      promptPattern: '【当 ___ 的时候】，会想起【某事】。',
      promptHint: '可以试试：봄이 오면...（春天来了）· 음악을 들으면...（听音乐的时候）',
      charUnit: '字',
      feedback: '获得反馈 →',
      complete: '完成 ✓',
      emptyFeedback: '请先写一点内容，哪怕只是半句也可以。',
      strongFeedback: '你的句子很好地用了今天的结构：先设定“什么时候”，再接上感觉或回忆。这个句型正在变成你的表达。잘했어요!',
      conditionalFeedback: '条件句用得不错，场景已经打开了。再加上“想起什么”或“什么感受”会更完整。',
      koreanFeedback: '韩文字写得不错。试着用 봄이 오면... 这样的开头，把今天的结构用完整。',
      nonKoreanFeedback: '看起来你用了其他语言。试着用韩语写，简单的词也可以。',
      completionTitle: '今天的积木完成了！',
      completionSubtitle: (day) => `第 ${day} 天完成 — 做得很好`,
      brickUnit: '积木',
      brickTotal: '累计',
      completionSentenceLabel: '今日句子',
      share: '分享今日句子',
      tomorrow: (day) => `明天 · 第 ${day} 天`,
      seeTomorrow: '明天见 →',
      curriculumComplete: '课程完成！',
      copied: '已复制到剪贴板！',
      shareText: (day, ko, translation) => `第 ${day} 天 · LetterBrick Korean\n\n${ko}\n“${translation}”\n\n#LetterBrick #学韩语 #한국어`
    }
  };

  const dayLocalizations = {
    es: {
      1: {
        sentence: { translation: 'En los días de lluvia, pienso en algo cálido.', context: 'Una frase de ambiente íntimo: el deseo de sentir consuelo cuando llueve, como un monólogo tranquilo de K-drama.' },
        grammar: { explanation: '엔 viene de 에는. Marca el tema de un momento o lugar: “en / cuando se trata de”.', tip: 'Úsalo para abrir la escena: 아침엔 (por la mañana), 집엔 (en casa).' },
        vocab: ['día lluvioso', 'cálido/a', 'venir a la mente / acordarse'],
        variations: {
          casual: 'Cuando llueve, pienso en algo cálido.',
          formal: 'En los días de lluvia, me viene a la mente algo cálido.',
          kdrama: 'Cuando escucho la lluvia, no dejo de pensar en ti.'
        }
      },
      2: {
        sentence: { translation: 'Cuando la nostalgia se vuelve familiar, simplemente se convierte en vida cotidiana.', context: 'Una reflexión suave, como una frase al final de un episodio.' },
        grammar: { explanation: '도 añade “también” o “incluso” a un sustantivo.', tip: '아픔도 (incluso el dolor), 기쁨도 (también la alegría).' },
        vocab: ['nostalgia / añoranza', 'acostumbrarse', 'vida cotidiana'],
        variations: { casual: 'La nostalgia también se vuelve rutina.', formal: 'Cuando la nostalgia se vuelve familiar, se convierte en vida diaria.', kdrama: 'Extrañarte se volvió una costumbre.' }
      },
      3: {
        sentence: { translation: 'Mi corazón sigue yendo hacia allí.', context: 'Para hablar de una persona o un lugar que no puedes dejar de recordar.' },
        grammar: { explanation: '자꾸 significa “una y otra vez / no dejar de”.', tip: '자꾸 생각나 (me viene una y otra vez), 자꾸 눈물이 나 (no dejo de llorar).' },
        vocab: ['corazón / mente', 'repetidamente', 'allí'],
        variations: { casual: 'No dejo de pensar en ese lugar.', formal: 'Ese lugar sigue viniendo a mi mente.', kdrama: 'Mi corazón sigue yendo hacia ti.' }
      },
      4: {
        sentence: { translation: 'Hay días en los que, sin motivo, el corazón se acelera.', context: 'Esa emoción ligera que aparece sin explicación.' },
        grammar: { explanation: '괜히 significa “sin una razón clara”.', tip: '괜히 웃음이 나다 (sonreír sin motivo), 괜히 눈물이 나다 (llorar sin motivo).' },
        vocab: ['sin motivo', 'emocionarse / sentir mariposas', 'día'],
        variations: { casual: 'Hoy estoy emocionado/a sin saber por qué.', formal: 'Hay días en los que uno se emociona sin una razón especial.', kdrama: '¿Por qué me late así el corazón?' }
      },
      5: {
        sentence: { translation: 'Ahora ya ni siquiera puedo decir que te extraño.', context: 'La emoción de contener lo que uno quiere decir.' },
        grammar: { explanation: '~다는 말 convierte una frase en “las palabras de que...”.', tip: '좋다는 말 (decir que está bien), 괜찮다는 말 (decir que está bien).' },
        vocab: ['extrañar / querer ver', 'ahora', 'no poder hacer'],
        variations: { casual: 'Ya ni puedo decir que te extraño.', formal: 'Se me hizo difícil expresar la añoranza.', kdrama: 'Tengo tanto que decir, pero no puedo decir nada.' }
      },
      6: {
        sentence: { translation: 'Cuando siento un aroma familiar, se me cae el corazón.', context: 'Memoria por el olor: una emoción muy de K-drama.' },
        grammar: { explanation: '~면 significa “si / cuando” y se une al verbo.', tip: '보이면 (si lo veo), 생각나면 (cuando me viene a la mente).' },
        vocab: ['ser familiar', 'aroma', 'sentir que el corazón se hunde'],
        variations: { casual: 'Cuando huelo ese aroma, se me hunde el corazón.', formal: 'Al sentir un aroma familiar, el corazón se vuelve pesado.', kdrama: '¿Por qué siento que tu olor sigue aquí?' }
      },
      7: {
        sentence: { translation: 'Creo que me gustabas sin que nadie lo supiera.', context: 'Un sentimiento secreto, admitido solo mucho después.' },
        grammar: { explanation: '~던 것 같다 recuerda una acción o estado pasado con suavidad e incertidumbre.', tip: '알던 것 같다 (creo que sabía), 슬펐던 것 같다 (creo que estaba triste).' },
        vocab: ['sin que nadie lo sepa', 'gustar / tener sentimientos por', 'creo que solía...'],
        variations: { casual: 'Creo que solo yo sentía eso.', formal: 'Creo que me gustaba en silencio.', kdrama: 'Ni siquiera pude decir que me gustabas; me lo guardé todo.' }
      }
    },
    zh: {
      1: {
        sentence: { translation: '下雨天，我会想起温暖的东西。', context: '这是一句带有情绪画面的句子：下雨时想要被安慰的感觉，很像韩剧里的内心独白。' },
        grammar: { explanation: '엔 是 에는 的缩写，用来标记时间或地点的话题，相当于“在 / 到了……的时候”。', tip: '可以用来打开场景：아침엔（早上）、집엔（在家）。' },
        vocab: ['下雨天', '温暖的', '想起 / 浮现在脑海里'],
        variations: { casual: '下雨的时候会想起温暖的东西。', formal: '在下雨的日子里，会想起温暖的事物。', kdrama: '一听见雨声，就总是想起你。' }
      },
      2: {
        sentence: { translation: '思念如果变得熟悉，也就成了日常。', context: '一种安静的领悟，像韩剧结尾轻轻说出的话。' },
        grammar: { explanation: '도 接在名词后，表示“也 / 连……也”。', tip: '아픔도（连痛苦也）、기쁨도（喜悦也）。' },
        vocab: ['思念 / 想念', '变得习惯', '日常'],
        variations: { casual: '思念久了，也就成了日常。', formal: '思念若变得熟悉，就会成为日常。', kdrama: '想你这件事，已经变成习惯了。' }
      },
      3: {
        sentence: { translation: '我的心总是往那里去。', context: '适合表达一个人或一个地方一直萦绕心头。' },
        grammar: { explanation: '자꾸 表示“反复 / 总是忍不住”。', tip: '자꾸 생각나（总是想起）、자꾸 눈물이 나（总是想哭）。' },
        vocab: ['心 / 想法', '反复地', '那里'],
        variations: { casual: '总是想起那里。', formal: '那个地方总是浮现在脑海里。', kdrama: '我的心总是往你那里去。' }
      },
      4: {
        sentence: { translation: '有些日子会莫名心动。', context: '没有理由却突然轻轻心动的感觉。' },
        grammar: { explanation: '괜히 表示“没什么理由地 / 莫名地”。', tip: '괜히 웃음이 나다（莫名想笑）、괜히 눈물이 나다（莫名想哭）。' },
        vocab: ['莫名地', '心动 / 激动', '日子'],
        variations: { casual: '今天莫名有点心动。', formal: '有些日子会无缘无故地心动。', kdrama: '为什么心跳得这么厉害？' }
      },
      5: {
        sentence: { translation: '现在连“我想你”这句话也说不出口。', context: '把想说的话压在心里的疼痛。' },
        grammar: { explanation: '~다는 말 把一句话名词化，表示“说……的话”。', tip: '좋다는 말（说喜欢/说好）、괜찮다는 말（说没关系）。' },
        vocab: ['想见 / 想念', '现在', '不能做'],
        variations: { casual: '连想你这句话都说不出口。', formal: '表达思念变得困难了。', kdrama: '想说的话太多，却一句也说不出来。' }
      },
      6: {
        sentence: { translation: '闻到熟悉的香气时，心会沉下去。', context: '气味带来的记忆，是很韩剧式的情绪。' },
        grammar: { explanation: '~면 表示“如果 / 当……的时候”，接在动词词干后。', tip: '보이면（如果看见）、생각나면（想起来的时候）。' },
        vocab: ['熟悉', '香气 / 气味', '心沉下去'],
        variations: { casual: '闻到那个味道，心就沉下去。', formal: '闻到熟悉的香气时，心情会变得沉重。', kdrama: '为什么这里好像还留着你的味道？' }
      },
      7: {
        sentence: { translation: '我好像曾经偷偷喜欢过你。', context: '独自藏着的感情，很久以后才承认。' },
        grammar: { explanation: '~던 것 같다 用来回想过去的状态或动作，语气柔和又带一点不确定。', tip: '알던 것 같다（好像知道）、슬펐던 것 같다（好像曾经难过）。' },
        vocab: ['不让任何人知道', '喜欢 / 有好感', '好像曾经……'],
        variations: { casual: '好像只有我一个人在喜欢。', formal: '我好像曾在心里默默喜欢过。', kdrama: '连喜欢你都说不出口，只能一个人忍着。' }
      }
    }
  };

  function cloneWithLocale(entry, lang) {
    const localized = JSON.parse(JSON.stringify(entry));
    const loc = dayLocalizations[lang] && dayLocalizations[lang][entry.day];
    if (!loc) return localized;
    if (loc.sentence) Object.assign(localized.sentence, loc.sentence);
    if (loc.grammar) Object.assign(localized.grammar, loc.grammar);
    if (Array.isArray(loc.vocab)) {
      localized.vocab = localized.vocab.map((v, i) => Object.assign({}, v, {
        meaning: loc.vocab[i] || v.meaning
      }));
    }
    if (loc.variations) {
      Object.keys(loc.variations).forEach((key) => {
        if (localized.variations[key]) localized.variations[key].translation = loc.variations[key];
      });
    }
    return localized;
  }

  window.KO_LOCALES = common;
  window.getKoLocale = function(lang) {
    return common[lang] || common.en;
  };
  window.getLocalizedKoEntry = cloneWithLocale;
})();
