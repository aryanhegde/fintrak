"use client";

import { UserProfile } from "@clerk/nextjs";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SettingsPage = () => {
  return (
    <div className="max-w-screen-2xl mx-auto w-full pb-10 -mt-24">
      <Card className="border-none drop-shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl line-clamp-1">Settings</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <UserProfile routing="hash" />
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
