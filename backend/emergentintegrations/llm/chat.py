"""
Universal LLM adapter — supports Groq and OpenAI providers.
Automatically selects the right client based on provider setting.
"""
import asyncio


class UserMessage:
    def __init__(self, text: str):
        self.text = text


class LlmChat:
    def __init__(self, api_key: str, session_id: str = "", system_message: str = ""):
        self.api_key = api_key
        self.session_id = session_id
        self.system_message = system_message
        self._provider = "groq"
        self._model = "llama-3.1-8b-instant"

    def with_model(self, provider: str, model: str) -> "LlmChat":
        self._provider = provider or "groq"
        self._model = model or "llama-3.1-8b-instant"
        return self

    async def send_message(self, message: UserMessage) -> str:
        messages = []
        if self.system_message:
            messages.append({"role": "system", "content": self.system_message})
        messages.append({"role": "user", "content": message.text})

        if self._provider == "openai":
            return await self._call_openai(messages)
        else:
            return await self._call_groq(messages)

    async def _call_groq(self, messages: list) -> str:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=self.api_key)
        response = await client.chat.completions.create(
            model=self._model,
            messages=messages,
        )
        return response.choices[0].message.content or ""

    async def _call_openai(self, messages: list) -> str:
        import openai
        client = openai.AsyncOpenAI(api_key=self.api_key)
        response = await client.chat.completions.create(
            model=self._model,
            messages=messages,
        )
        return response.choices[0].message.content or ""
