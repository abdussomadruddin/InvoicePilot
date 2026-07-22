const assert = require("node:assert/strict");
const test = require("node:test");

const { buildThreadsGeneralText } = require("../lib/threads-general-copy");

const STRUCTURES = [
  "Hot Take",
  "Relatable Pain",
  "Contrarian",
  "List Style",
  "Story Style",
  "Comparison",
  "Warning",
  "Recommendation",
  "Local Malaysian Angle",
  "Business Insight",
];

function parts(structure, toneLead = "aku cakap jujur, kerja dari rumah memang kena cari rentak sendiri") {
  return {
    structure,
    topic: "kerja dari rumah",
    toneLead,
    audienceLead: "kalau kau working adult yang tengah cuba susun masa, benda ni memang terasa",
    hook: "aku baru perasan benda kecil pasal kerja dari rumah",
    opening: "semalam aku cuba ubah satu rutin je",
    angle: "mula dengan satu task yang paling senang siap",
    pain: "kepala cepat serabut bila semua benda nak buat serentak",
    emotion: "bila dah nampak progress kecil, rasa lega sikit",
    middle: "tak perlu perfect, cukup bagi diri sendiri ruang nak gerak",
    context: "dekat Malaysia, rumah memang bukan sentiasa tempat paling tenang nak fokus",
  };
}

test("all Threads General structures stay natural, clean and open-ended", () => {
  const outputs = STRUCTURES.map((structure) => buildThreadsGeneralText(parts(structure)));

  for (const text of outputs) {
    assert.ok(text.length > 20);
    assert.ok(text.length <= 500);
    assert.doesNotMatch(text, /\?|\*\*|:/);
    assert.doesNotMatch(text, /https?:\/\//);
    assert.doesNotMatch(text.toLowerCase(), /yang menarik bukan sekadar|sangat berpotensi|kesimpulannya|dalam era digital|adalah penting untuk/);
  }

  assert.equal(new Set(outputs).size, STRUCTURES.length);
});

test("tone and audience context materially change Threads General copy", () => {
  const casual = buildThreadsGeneralText(parts("Relatable Pain", "jujur, benda ni memang ambil masa nak biasakan"));
  const direct = buildThreadsGeneralText(parts("Relatable Pain", "aku terus terang je, pilih satu benda dan siapkan dulu"));

  assert.notEqual(casual, direct);
  assert.match(casual, /jujur/);
  assert.match(direct, /terus terang/);
  assert.match(casual, /working adult/);
});

test("question marks and robotic punctuation are stripped from source fragments", () => {
  const text = buildThreadsGeneralText({
    ...parts("Story Style"),
    toneLead: "pernah rasa benda ni terlalu susah?: **aku pun pernah**",
  });

  assert.doesNotMatch(text, /\?|\*\*|:/);
});
