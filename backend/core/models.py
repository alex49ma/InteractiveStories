from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class StoryOptionLLM(BaseModel):
    text:str = Field(description="The text of the option shown to the user")
    nextNode: Dict[str, Any] = Field(description="The next node content and its options")

class StoryNodeLLM(BaseModel):
    content: str=Field(description="The content of the story node")
    isEnding: bool=Field(description="Whether the node is an ending")
    isWinningEnding: bool=Field(description="Whether the node is a winning ending")
    options: Optional[List[StoryOptionLLM]]=Field(default=None, description="The options available to the user")

class StoryLLMResponse(BaseModel):
    title: str = Field(description="The title of the story")
    rootNode: StoryNodeLLM = Field(description="The root node of the story")