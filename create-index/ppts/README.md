# Songbook Generator

Convert PowerPoint (.pptx) song files into a formatted PDF songbook with table of contents.

## Features

- Extracts songs from multiple year folders (2021-2025)
- Generates structured XML intermediate format
- Creates beautifully formatted PDF with:
  - Custom page size (digest format)
  - Headers on every page
  - Page numbers
  - Bold italic translations
- Produces alphabetically sorted table of contents

## Installation

Using [uv](https://github.com/astral-sh/uv):

```bash
# Clone or download the project
cd songbook-generator

# Install dependencies
uv sync