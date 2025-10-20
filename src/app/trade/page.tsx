import { Chat } from "@/components/Chat";

export default function TradePage() {
  return (
    <>
      <div className="text-center mb-12 mt-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
          <span className="gradient-text">
            Trade tokens using natural language
          </span>
        </h1>
      </div>

      <div className="max-w-4xl mx-auto mb-12 px-4 sm:px-6">
        <Chat key="new" />
      </div>
    </>
  );
}
