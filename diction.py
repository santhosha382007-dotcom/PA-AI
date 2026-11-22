from difflib import get_close_matches
import os
import json

try:
    import pyttsx3
    engine = pyttsx3.init()
    voices = engine.getProperty('voices')
    engine.setProperty('voice', voices[0].id)
except Exception:
    engine = None

try:
    import speech_recognition as sr
except Exception:
    sr = None

data_path = os.path.join(os.path.dirname(__file__), 'data.json')
try:
    with open(data_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
except Exception:
    data = {}


def speak(audio):
    if engine:
        try:
            engine.say(audio)
            engine.runAndWait()
        except Exception:
            pass
    else:
        print(f"[Dict]: {audio}")


def takeCommand():
    r = sr.Recognizer()
    with sr.Microphone() as source:
        print('Listening...')
        r.pause_threshold = 1
        r.energy_threshold = 494
        r.adjust_for_ambient_noise(source, duration=1.5)
        audio = r.listen(source)

    try:
        print('Recognizing..')
        query = r.recognize_google(audio, language='en-in')
        print(f'User said: {query}\n')

    except Exception as e:
        # print(e)

        print('Say that again please...')
        return 'None'
    return query


def translate(word):
    word = word.lower()
    if word in data:
        speak(data[word])
    elif len(get_close_matches(word, data.keys())) > 0:
        x = get_close_matches(word, data.keys())[0]
        speak('Did you mean ' + x +
              ' instead,  respond with Yes or No.')
        ans = takeCommand().lower()
        if 'yes' in ans:
            speak(data[x])
        elif 'no' in ans:
            speak("Word doesn't exist. Please make sure you spelled it correctly.")
        else:
            #changed from we to I
            speak("I did not understand your entry.")

    else:
        speak("Word doesn't exist. Please double check it.")


if __name__ == '__main__':
    translate()
