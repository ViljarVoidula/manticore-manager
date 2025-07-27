import React, { useState, useEffect } from 'react';
import { useCreate, useUpdate } from '@refinedev/core';
import { TableInfo } from '../../types/manticore';
import { FormField, Modal, FormActions } from '../forms';
import { toastMessages } from '../../utils/toast';

interface Document {
  id?: string | number;
  [key: string]: unknown;
}

interface DocumentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  table: TableInfo;
  editingDocument?: Document | null;
}

export const DocumentForm: React.FC<DocumentFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  table,
  editingDocument
}) => {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const { mutate: createDocument } = useCreate();
  const { mutate: updateDocument } = useUpdate();

  // Initialize form data when component opens or editing document changes
  useEffect(() => {
    if (isOpen) {
      if (editingDocument) {
        setFormData({ ...editingDocument });
      } else {
        // Initialize with default values for new document
        const initialData: Record<string, unknown> = {};
        table.columns?.forEach((column) => {
          if (column.field !== 'id') {
            switch (column.type) {
              case 'integer':
              case 'bigint':
                initialData[column.field] = 0;
                break;
              case 'float':
                initialData[column.field] = 0.0;
                break;
              case 'bool':
                initialData[column.field] = false;
                break;
              case 'json':
                if (column.field === 'data') {
                  initialData[column.field] = {
                    title: "Sample Document",
                    content: "Document content here",
                    tags: ["tag1", "tag2"]
                  };
                } else {
                  initialData[column.field] = {};
                }
                break;
              default:
                initialData[column.field] = '';
            }
          }
        });
        setFormData(initialData);
      }
    }
  }, [isOpen, editingDocument, table.columns]);

  const handleInputChange = (field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingDocument) {
      updateDocument(
        {
          resource: table.name,
          id: editingDocument.id,
          values: formData,
        },
        {
          onSuccess: () => {
            onSuccess();
            onClose();
            toastMessages.documentUpdated();
          },
          onError: (error) => {
            toastMessages.generalError('update document', error);
          },
        }
      );
    } else {
      createDocument(
        {
          resource: table.name,
          values: formData,
        },
        {
          onSuccess: () => {
            onSuccess();
            onClose();
            toastMessages.documentCreated();
          },
          onError: (error) => {
            toastMessages.generalError('create document', error);
          },
        }
      );
    }
  };

  const handleClose = () => {
    setFormData({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={editingDocument ? 'Edit Document' : 'Create Document'}
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-3 lg:space-y-4">
        {table.columns
          ?.filter(column => column.field !== 'id' || editingDocument)
          .map((column) => (
            <FormField
              key={column.field}
              label={column.field}
              field={column.field}
              type={column.type}
              value={formData[column.field]}
              onChange={handleInputChange}
              disabled={column.field === 'id' && Boolean(editingDocument)}
              tableName={table.name}
              formData={formData}
            />
          ))}

        <FormActions
          onCancel={handleClose}
          submitLabel={editingDocument ? 'Update' : 'Create'}
        />
      </form>
    </Modal>
  );
};
