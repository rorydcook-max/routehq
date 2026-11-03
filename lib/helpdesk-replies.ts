/**
 * Saved replies the RoveHQ team can drop into the helpdesk composer, then edit before sending.
 * TODO: let the team edit these from /platform/support. That needs somewhere platform-wide to keep them (a settings
 * row or a support_saved_replies table), which means a migration; until then they live here and change with a deploy.
 */
export type SavedReply = { id: string; label: string; body: string };

export const SAVED_REPLIES: SavedReply[] = [
  {
    id: "greeting",
    label: "Hello, looking into it",
    body: "Hi, thanks for getting in touch. I'm looking into this now and will come back to you here shortly."
  },
  {
    id: "more-detail",
    label: "Ask for more detail",
    body: "Thanks. Could you tell me a bit more so I can help? A screenshot of the page and what you expected to happen would be perfect."
  },
  {
    id: "import",
    label: "Import: send your files",
    body: "We can import your existing records for you, free on every plan. Send your spreadsheet, a photo of your notebook or your vehicle documents here and we'll set it all up."
  },
  {
    id: "fixed",
    label: "Fixed, please check",
    body: "That's fixed now. Could you refresh the page and check it works for you? If anything still looks wrong, just reply here."
  },
  {
    id: "closing",
    label: "Closing, reply to reopen",
    body: "I'll mark this as sorted for now. If you need anything else, just reply here and it comes straight back to us."
  }
];
