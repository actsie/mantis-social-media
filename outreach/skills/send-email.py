#!/usr/bin/env python3
"""
Send skill confirmation email via AgentMail

Usage:
    python send-email.py <to_email> <skill_name> <slug> <description>
"""

import sys
import os
import requests
from agentmail import AgentMail

# Discord webhook for email confirmations
DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1484083649342345288/vddvZ2_HrY3syCrS1wkRlWeVLSlnMTnkpq2FFVLqGch0jUxoOT8NiFbA1rxGJPqqwUfX"

if len(sys.argv) != 5:
    print("Usage: python send-email.py <to_email> <skill_name> <slug> <description>")
    sys.exit(1)

to_email = sys.argv[1]
skill_name = sys.argv[2]
slug = sys.argv[3]
description = sys.argv[4]

# Get API key from environment
api_key = os.environ.get("AGENTMAIL_API_KEY")
if not api_key:
    print("Error: AGENTMAIL_API_KEY environment variable not set")
    sys.exit(1)

# Initialize client
client = AgentMail(api_key=api_key)

# Send email
inbox_id = "skills-pawgrammer-request@agentmail.to"

try:
    response = client.messages.send(
        inbox_id=inbox_id,
        to=[to_email],
        subject=f"Your skill request is live on Pawgrammer 🎉",
        text=f"""Hey!

Great news — your skill request has been approved and is now live on Pawgrammer.

🔗 View your skill: skills.pawgrammer.com/skills/{slug}

Here's what was built:
• Skill: {skill_name}
• Description: {description}

Thanks for contributing to the Pawgrammer skills directory. Your skill is now available for everyone to use!

— Pawgrammer Team
skills.pawgrammer.com"""
    )
    print(f"Email sent to {to_email}")
    print(f"Message ID: {response.message_id}")
    
    # Post confirmation to Discord
    try:
        requests.post(DISCORD_WEBHOOK, json={
            "content": f"📧 Email sent to {to_email} for skill: {skill_name}"
        })
        print(f"Discord notification sent")
    except Exception as webhook_error:
        print(f"Discord webhook failed: {webhook_error}")
        
except Exception as e:
    print(f"Error sending email: {e}")
    sys.exit(1)
