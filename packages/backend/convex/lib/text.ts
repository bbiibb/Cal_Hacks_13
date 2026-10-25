/** Very small stemmer: enough to treat "valves" and "valve" or "anchors" and "anchored" alike. */
export function stem(word: string): string {
  let w = word;
  if (w.length > 6 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 5 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 5 && /(sses|xes|ches|shes|zes)$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  // "valve" and "valves" must end up the same
  if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1);
  // "recover" and "recovery", "deliver" and "delivery"
  if (w.length > 6 && w.endsWith("y")) w = w.slice(0, -1);
  return w;
}

const STOPWORDS = new Set(
  (
    "about above after again against also because been before being below between both cannot could does doing down during each " +
    "either else even ever every from further have having here hers herself himself into itself just like make many might more most " +
    "much must myself once only other ought ourselves over same should some such than that their theirs them themselves then there " +
    "these they this those through under until very want were what when where which while whom will with would your yours yourself " +
    "yourselves please sorry thanks thank okay sure maybe also still well need needs help helps able " +
    "likely chance chances happen happens often usually really actually probably take takes long give gives"
  ).split(" "),
);

/** Words about moving the 3D view: the answer to a camera command is not a medical claim. */
const COMMAND_WORDS = new Set(
  (
    "zoom zoomed zooming rotate rotated rotating turn turned turning view camera model step steps moved moving showing show shown " +
    "reset resetting restored default position degrees left right closer further farther highlighted highlight focus focused done " +
    "here screen part parts"
  ).split(" "),
);

/** Meaningful words of a text, lower-cased and stemmed. */
export function contentWords(text: string): string[] {
  const tokens = text.toLowerCase().match(/[a-z][a-z'-]*/g) ?? [];
  return tokens
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t) && !COMMAND_WORDS.has(t))
    .map(stem);
}
