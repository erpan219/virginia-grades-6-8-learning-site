/* BEGIN VA CONTENT CORRECTIONS 2026-11-09 */
(function () {
  if (LESSONS._vaContentCorrections === '2026-11-09') return;
  var corrections = [{"lesson":6,"title":"Theme & Main Idea","field":["ex"],"value":["In 'The Tortoise and the Hare,' the topic is a race. A main-idea statement is: \u003cb>a steady tortoise defeats an overconfident hare in a race\u003c/b>. A supported theme is: \u003cb>steady effort can succeed where overconfidence fails\u003c/b>. The theme applies beyond this particular race.","在《龟兔赛跑》中，话题是一场比赛。中心思想可以表述为：\u003cb>坚持前进的乌龟在比赛中战胜了过度自信的兔子\u003c/b>。有依据的主题是：\u003cb>坚持努力能取得成功，过度自信却可能导致失败\u003c/b>。主题的意义超出了这场具体比赛。"]},{"lesson":23,"title":"Two-Step Equations","field":["q",6,0],"value":"To solve 6x + 2 = 20, Zoe correctly divides every term by 6. Why might subtracting 2 first be a simpler choice?"},{"lesson":23,"title":"Two-Step Equations","field":["q",6,1],"value":"解 6x + 2 = 20 时，佐伊正确地把每一项都除以 6。为什么先减 2 可能更简便？"},{"lesson":23,"title":"Two-Step Equations","field":["q",6,4],"value":"Both methods are valid. Dividing every term gives x + 1/3 = 10/3, then x = 3. Subtracting 2 first gives 6x = 18, then x = 3, without fractions."},{"lesson":23,"title":"Two-Step Equations","field":["q",6,5],"value":"两种方法都正确。每一项除以 6 得 x + 1/3 = 10/3，再得 x = 3。先减 2 得 6x = 18，再得 x = 3，可以避免分数。"},{"lesson":23,"title":"Two-Step Equations","field":["q",6,6],"value":"Compare the intermediate numbers. A less convenient step can still be mathematically correct."},{"lesson":23,"title":"Two-Step Equations","field":["q",6,7],"value":"比较中间步骤的数字。不够简便的一步，数学上仍可能正确。"},{"lesson":34,"title":"DNA, Genes & Heredity","field":["bg",0],"value":["In a simple complete-dominance model, one dominant allele is enough for the dominant phenotype to appear. A recessive phenotype appears when both alleles are recessive. A carrier can pass on a recessive allele without showing that phenotype. This model describes some inheritance patterns, not every trait.","在简单的完全显性模型中，一个显性等位基因就足以使显性性状表现。两个等位基因都为隐性时，隐性性状才表现。携带者可以不表现隐性性状，却仍把隐性等位基因传给后代。这个模型描述一些遗传方式，并不适用于每一种性状。"]},{"lesson":34,"title":"DNA, Genes & Heredity","field":["bg",1],"value":["Many human traits, including eye color, involve multiple genes. Simple Punnett squares help us learn probability for a defined one-gene model; they cannot predict every feature of a real person. Breeders also study inheritance when selecting traits in plants and animals.","许多人类性状，包括眼睛颜色，都涉及多个基因。简单的庞氏方格有助于学习特定单基因模型中的概率，但不能预测真实人物的所有特征。育种者在选择植物和动物性状时，也会研究遗传。"]},{"lesson":34,"title":"DNA, Genes & Heredity","field":["v",2],"value":["dominant","显性的","Describes an allele expressed in the phenotype when one copy is present, in a complete-dominance model. It does not mean more common or better.","在完全显性模型中，指一份就能在表现型中体现的等位基因；不表示更常见或更好。"]}];
  // Check every field before replacing any text. Never insert or reorder records.
  corrections.forEach(function (c) {
    var target = LESSONS[c.lesson];
    if (!target || target.t[0] !== c.title) throw new Error('Content correction lesson mismatch: ' + c.lesson);
    c.field.forEach(function (key) {
      if (target == null || !Object.prototype.hasOwnProperty.call(target, key)) {
        throw new Error('Content correction field mismatch: ' + c.lesson);
      }
      target = target[key];
    });
  });
  corrections.forEach(function (c) {
    var target = LESSONS[c.lesson];
    for (var i = 0; i < c.field.length - 1; i++) target = target[c.field[i]];
    target[c.field[c.field.length - 1]] = c.value;
  });
  Object.defineProperty(LESSONS, '_vaContentCorrections', { value: '2026-11-09' });
})();
/* END VA CONTENT CORRECTIONS 2026-11-09 */
