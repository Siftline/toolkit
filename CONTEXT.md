# Siftline toolkit

The published half of Siftline: the Engine, the CLI over it and the Action adapters. The
hosted app lives in the private `Siftline/cloud` repo. This file owns the Engine's terms;
cloud mirrors them verbatim and keeps its own terms (Source, Review queue and the rest) there.

## Language

**Engine**:
The text-sorting library: judge, recipe, fixtures and rules evaluator. Implemented by the `@siftline/core` package; "core" is a package name, not a domain term.
_Avoid_: core, library, SDK

**Record**:
One normalised input to the Engine: an id and the state to judge, as text or JSON. Every Decision is about exactly one Record. Sender, Source and raw payload belong to whoever supplies the Record; the Engine never sees them.
_Avoid_: message, item, event, entry

**Recipe**:
The questions asked of every Record (a category, yes/no checks, a score), the pinned model and the review threshold. Edits produce a new version; a Decision always names the version that made it.
_Avoid_: template (the UI word for it), config, prompt

**Question**:
One bounded thing a Recipe asks of a Record: a Choice (one label from a set), a Noul (yes/no) or a Score (one level from an ordered list). The Engine never asks for generated text.
_Avoid_: prompt, field, classifier

**Decision**:
The Engine's Answers for one Record together with the model's confidence in them, whether it is Unsure, the rule that matched and the Action it selected.
_Avoid_: result, judgment, verdict, classification

**Answers**:
The plain values a Decision gives for each Question: a label, a yes/no, or a level. The same shape a person writes in a Fixture or a correction; carries no confidence.
_Avoid_: output, predictions, labels

**Unsure**:
A Decision whose confidence, the lowest across its Questions, is below the Recipe's review threshold. Unsure Records go to Review instead of an Action.
_Avoid_: low confidence, uncertain, flagged

**Review**:
Where an Unsure Record waits for a person to answer instead of the model. The hosted app has a queue for it; the toolkit hands the Record back with `review: true` and selects no Action.
_Avoid_: queue, triage, manual

**Rule**:
One entry in a Recipe's ordered list that maps a Decision's answers to an Action, by its id, or to nothing. The first matching Rule wins; "send to Review when unsure" is built in, not a Rule.
_Avoid_: trigger, workflow, automation

**Fixture**:
One labelled example for a Recipe: an input and the answers a person says are right. The Engine's test runs over them.
_Avoid_: example (the UI word for it), test case, training data, label

**Action**:
A named, configured outbound effect that a Rule selects for a Decision, such as "linear-tickets". Each Action has an id and exactly one Action kind. Two Actions can share a kind and send to different places.
_Avoid_: output, integration, connector

**Action kind**:
The type of an Action, which decides how its request is built: webhook or Slack incoming webhook. Each Action kind has exactly one Adapter.
_Avoid_: action type, channel

**Adapter**:
The concrete implementation of one Action kind: it builds the request an Action sends for a Decision. Adapters are thin; the Engine never depends on them.
_Avoid_: plugin, driver

**Judge**:
The Engine module that sends one Record's Questions to the pinned model in one request and returns a Decision with no Rule applied. It chooses how patiently the injected client retries and caps calls in flight; it never selects an Action.
_Avoid_: classifier, client (the injected transport is the client; the Judge wraps it)
