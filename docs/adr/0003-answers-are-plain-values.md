# Answers are plain values; the model's evidence sits beside them

Date: 2026-09-21
Status: accepted

A Decision's answers are read by three consumers that a person also writes: Fixture
`expect`, a Review correction, and the Rule evaluator. A person cannot supply a confidence
or a probability map, and a Rule must give the same result on a correction as on the
model's answer. So `Answers` is a plain value map (Choice → label, Noul → boolean, Score →
level index) with no confidence in it, and the Decision keeps the model's confidence and
probabilities in a separate per-Question block. Confidence folds into one number, the
minimum across Questions, and "unsure" is that number below the Recipe's threshold.

## Consequences

- One type serves Fixture `expect`, `corrected_answers` and Rules. Corrections need no
  fake confidence, and Rules cannot branch on confidence (ADR 0001 keeps unsure built in).
- Reading the model's probabilities means reading the evidence block, not the answers.
- The JSONL Decision line is a file format shared with the hosted app; changing this split
  is a `format` bump.
