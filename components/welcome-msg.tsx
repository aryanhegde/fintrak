"use client";

import { useUser } from "@clerk/nextjs";

export const WelcomeMsg = () => {
  const { user, isLoaded } = useUser();

  return (
    <div className="space-y-1">
      <h2 className="text-xl lg:text-2xl font-semibold text-white">
        Welcome Back{isLoaded ? ", " : " "}
        {user?.firstName}
      </h2>
      <p className="text-sm text-blue-200">This is your financial overview</p>
    </div>
  );
};
