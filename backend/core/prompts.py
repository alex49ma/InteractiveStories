STORY_PROMPT = """
                You are a creative story writer, and you are going to create engaging choose-your-own-adventure stories.
                Generate a complete branching story with multiple paths and endings in the JSON format I'll specify.

                Story structure requirements:
                - Each node should have between 1 and 4 options except for ending nodes
                - Add variety in the path lengths (some end earlier, some later)
                - Make sure there's at least one winning path

                The story should have:
                1. A title
                2. A starting node (beginning of the story) with between 1 and 4 options
                3. Each option should lead to another node with its own options
                4. Some paths should lead to endings (both winning and losing)
                5. At least one path should lead to a winning ending

                Output your story in this exact JSON structure:
                {format_instructions}

                Don't simplify or omit any part of the story structure. 
                Don't add any text outside of the JSON structure.
                """

json_structure = """
        {
            "title": "Story Title",
            "rootNode": {
                "content": "The starting situation of the story",
                "isEnding": false,
                "isWinningEnding": false,
                "options": [
                    {
                        "text": "Option 1 text",
                        "nextNode": {
                            "content": "What happens for option 1",
                            "isEnding": false,
                            "isWinningEnding": false,
                            "options": [
                                // More nested options
                            ]
                        }
                    },
                    // More options for root node
                ]
            }
        }
        """