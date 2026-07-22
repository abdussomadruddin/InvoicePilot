function buildThreadsGeneralText(parts = {}) {
  function clean(value) {
    return String(value || "")
      .replace(/\*\*/g, "")
      .replace(/:/g, ",")
      .replace(/\?/g, "")
      .replace(/\s+/g, " ")
      .replace(/\s+([,.!?])/g, "$1")
      .trim()
      .replace(/[.!?]+$/g, "");
  }

  function sentence(value) {
    const text = clean(value);
    return text ? `${text}.` : "";
  }

  function paragraphs(lines) {
    return lines.map(sentence).filter(Boolean).join("\n\n");
  }

  const structure = clean(parts.structure) || "Story Style";
  const topic = clean(parts.topic) || "benda ni";
  const toneLead = clean(parts.toneLead);
  const audienceLead = clean(parts.audienceLead);
  const hook = clean(parts.hook);
  const opening = clean(parts.opening);
  const angle = clean(parts.angle);
  const pain = clean(parts.pain);
  const emotion = clean(parts.emotion);
  const middle = clean(parts.middle);
  const context = clean(parts.context);

  if (structure === "Hot Take") {
    return paragraphs([toneLead || hook, angle, middle]);
  }
  if (structure === "Relatable Pain") {
    return paragraphs([toneLead, audienceLead, pain, middle]);
  }
  if (structure === "Contrarian") {
    return paragraphs([`ramai orang fikir ${topic} kena buat besar-besar`, toneLead || "aku rasa tak semestinya", angle]);
  }
  if (structure === "List Style") {
    return [
      sentence(toneLead),
      sentence(`aku belajar tiga benda pasal ${topic}`),
      [`1. ${clean(angle)}`, `2. ${clean(middle)}`, `3. ${clean(context)}`].join("\n"),
    ].filter(Boolean).join("\n\n");
  }
  if (structure === "Story Style") {
    return paragraphs([toneLead, opening || hook, `lepas tu baru aku sedar, ${middle}`]);
  }
  if (structure === "Comparison") {
    return paragraphs([toneLead, `dulu aku selalu overthink pasal ${topic}`, `sekarang aku nampak benda ni lebih jelas, ${angle}`]);
  }
  if (structure === "Warning") {
    return paragraphs([toneLead, `aku selalu nampak orang tersangkut sebab ${pain}`, angle, emotion]);
  }
  if (structure === "Recommendation") {
    return paragraphs([toneLead || opening, audienceLead, angle]);
  }
  if (structure === "Local Malaysian Angle") {
    return paragraphs([toneLead, context, opening || hook]);
  }
  return paragraphs([context, toneLead || audienceLead, angle]);
}

module.exports = { buildThreadsGeneralText };
