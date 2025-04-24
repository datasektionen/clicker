defmodule ClickEx.Repo.Migrations.CreateClicker do
  use Ecto.Migration

  def change do
    create table(:clicker, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :count, :integer

      timestamps(type: :utc_datetime)
    end
  end
end
