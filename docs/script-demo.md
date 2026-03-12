# Script Demo

Read this almost verbatim if you want a clean recording.

## Opening

This is Nerdy, a realtime AI tutor.  
The core loop is student input, streamed reasoning, synthesized speech, and a visible avatar response that feels conversational instead of chatbot like.

## Session

I am on the session page now.  
You can see the active tutor, the current lesson context, the prompt box, and the main controls: Send, Hold to talk, History, and New.

I will start with a simple fractions question.

Type:

`Fractions still confuse me.`

Click `Send`.

Now watch two things at once.  
First, the tutor starts responding immediately.  
Second, the default SVG avatar has visible mouth motion tied to the word timings coming back from the speech path.

## Socratic Follow Up

Now I will answer the tutor and keep the lesson going.

Type:

`I think one slice out of four is one fourth.`

Click `Send`.

This is the part that matters educationally.  
The tutor is not dumping an answer.  
It is continuing the same thread and asking the next useful question.

## History

I will open History.

This shows the current lesson thread and proves the follow-up turns are being preserved.  
If I start a new lesson, the current thread is archived instead of being silently lost.

## Interrupt

I will close History and run one more turn.

Type:

`Can you give me one more hint?`

Click `Send`.

While the tutor is speaking, press `Escape`.

The response stops immediately, and the tutor is ready for the next turn.  
That interruption behavior is important because it makes the interaction feel conversational rather than locked.

## Avatar Switch

Now I will go to the avatar page.

Here the lightweight 2D tutor is the default path.  
I can opt into the 3D tutor when I want a richer visual branch.

Switch to `3D`.  
Select `Human 3D`.

Now switch back to `2D`.  
Select `Robot`.

This shows that the avatar layer is modular and can change without rewriting the session contract.

## Close

On the verification side, the backend test suite is green, the frontend verify gate is green, and the browser smoke suite is green.  
That includes a browser regression that explicitly checks visible mouth motion on the default tutor.

So the engineering story is complete: realtime tutor loop, visible lip sync, interruption, history continuity, and avatar switching are all verified.  
The only remaining manual step, if we need it, is recording the final demo video.
