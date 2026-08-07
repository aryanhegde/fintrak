import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useCSVReader } from "react-papaparse";

type Props = {
  onUpload: (results: any) => void;
};

export const UploadButton = ({ onUpload }: Props) => {
  const { CSVReader } = useCSVReader();

  // TODO: Add a paywall

  return (
    <CSVReader onUploadAccepted={onUpload}>
      {({ getRootProps }: any) => (
        <Button
          size="sm"
          variant="outline"
          className="h-9 w-full rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 sm:w-auto"
          {...getRootProps()}
        >
          <Upload className="mr-2 size-4" />
          Import CSV
        </Button>
      )}
    </CSVReader>
  );
};
