import os
import requests
import json
NEWS_API_KEY = os.getenv('NEWS_API_KEY', 'f9e9b9355f3e4334a20d16a09b39d72d')

try:
    import pyttsx3
    engine = pyttsx3.init()
    voices = engine.getProperty('voices')
    engine.setProperty('voice', voices[0].id)
except Exception:
    engine = None


def speak(audio):
    if engine:
        try:
            engine.say(audio)
            engine.runAndWait()
        except Exception:
            pass
    else:
        print(f"[News]: {audio}")


def speak_news():
    url = f'https://newsapi.org/v2/top-headlines?sources=the-times-of-india&apiKey={NEWS_API_KEY}'
    try:
        response = requests.get(url)
        news_dict = response.json()
        if news_dict.get('status') != 'ok':
            speak('Sorry Sir, could not fetch the news at the moment.')
            return

        arts = news_dict.get('articles', [])
        if not arts:
            speak('No news headlines found at this time, Sir.')
            return

        speak('Source: The Times Of India')
        speak("Today's Headlines are..")
        for index, articles in enumerate(arts):
            speak(articles['title'])
            if index == len(arts) - 1:
                break
            speak('Moving on to the next news headline..')
        speak('These were the top headlines. Have a nice day Sir!')
    except Exception as e:
        speak('An error occurred while fetching the news, Sir.')


def getNewsUrl():
    return 'https://timesofindia.indiatimes.com/'

if __name__ == '__main__':
    speak_news()
