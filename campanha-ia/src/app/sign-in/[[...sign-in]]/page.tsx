import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
            CriaLook
          </h1>
          <p className="text-gray-400 mt-2">Entre na sua conta</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-gray-900/80 border border-gray-800 shadow-2xl backdrop-blur-xl",
              headerTitle: "text-white",
              headerSubtitle: "text-gray-400",
              socialButtonsBlockButton:
                "bg-gray-800 border-gray-700 text-white hover:bg-gray-700",
              formFieldLabel: "text-gray-300",
              formFieldInput:
                "bg-gray-800 border-gray-700 text-white placeholder:text-gray-500",
              footerActionLink: "text-fuchsia-400 hover:text-fuchsia-300",
              formButtonPrimary:
                "bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500",
            },
          }}
        />
      </div>
    </div>
  );
}
