# -*- coding: utf-8 -*-
"""Master builder script to assemble AURA_HMS_COMPLETE_USER_AND_SYSTEM_GUIDE.md"""

import os
import sys

# Ensure guide_sections can be imported
sys.path.insert(0, os.path.dirname(__file__))

from guide_sections.part1_overview import get_part1
from guide_sections.part2_accounts import get_part2
from guide_sections.part3_modules_core import get_part3_core
from guide_sections.part3_modules_clinical import get_part3_clinical
from guide_sections.part3_modules_finance import get_part3_finance
from guide_sections.part3_modules_admin import get_part3_admin
from guide_sections.part4_workflows import get_part4
from guide_sections.part5_glossary import get_part5
from guide_sections.part6_architecture import get_part6
from guide_sections.part7_dashboards import get_part7
from guide_sections.part8_security import get_part8
from guide_sections.part9_troubleshooting import get_part9
from guide_sections.part10_demo_guide import get_part10

def build_guide():
    print("Assembling complete HMS User & System Guide...")
    
    sections = [
        get_part1(),
        "\n\n---\n\n",
        get_part2(),
        "\n\n---\n\n",
        get_part3_core(),
        "\n\n---\n\n",
        get_part3_clinical(),
        "\n\n---\n\n",
        get_part3_finance(),
        "\n\n---\n\n",
        get_part3_admin(),
        "\n\n---\n\n",
        get_part4(),
        "\n\n---\n\n",
        get_part5(),
        "\n\n---\n\n",
        get_part6(),
        "\n\n---\n\n",
        get_part7(),
        "\n\n---\n\n",
        get_part8(),
        "\n\n---\n\n",
        get_part9(),
        "\n\n---\n\n",
        get_part10(),
    ]
    
    full_content = "".join(sections)
    
    # Target output paths
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "docs")
    os.makedirs(output_dir, exist_ok=True)
    
    output_file = os.path.join(output_dir, "AURA_HMS_COMPLETE_USER_AND_SYSTEM_GUIDE.md")
    
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(full_content)
        
    line_count = len(full_content.splitlines())
    word_count = len(full_content.split())
    file_size_kb = os.path.getsize(output_file) / 1024
    
    print(f"SUCCESS: Generated {output_file}")
    print(f"Total Lines: {line_count:,}")
    print(f"Total Words: {word_count:,}")
    print(f"File Size: {file_size_kb:.2f} KB")

if __name__ == "__main__":
    build_guide()

