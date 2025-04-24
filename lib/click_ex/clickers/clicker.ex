defmodule ClickEx.Clickers.Clicker do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "clicker" do
    field :count, :integer, default: 0

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(clicker, attrs) do
    clicker
    |> cast(attrs, [:count])
  end
end
