import { redirect } from "next/navigation"

// Catch-all for any /simulate/[mode] that isn't a known static folder
// (mirofish, staple have their own folders which take priority)
export default function SimulateModePage({ params }: { params: { mode: string } }) {
  redirect("/simulate/mirofish")
}