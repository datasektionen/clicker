defmodule ClickEx.Clickers do
  @moduledoc """
  The Clickers context.
  """

  import Ecto.Query, warn: false
  alias Phoenix.PubSub
  alias ClickEx.Repo

  alias ClickEx.Clickers.Clicker

  @doc """
  Returns the list of clicker.

  ## Examples

      iex> list_clicker()
      [%Clicker{}, ...]

  """
  def list_clicker do
    Repo.all(Clicker)
  end

  @doc """
  Gets a single clicker.

  Raises `Ecto.NoResultsError` if the Clicker does not exist.

  ## Examples

      iex> get_clicker!(123)
      %Clicker{}

      iex> get_clicker!(456)
      ** (Ecto.NoResultsError)

  """
  def get_clicker!(id), do: Repo.get!(Clicker, id)

  @doc """
  Creates a clicker.

  ## Examples

      iex> create_clicker(%{field: value})
      {:ok, %Clicker{}}

      iex> create_clicker(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_clicker(attrs) do
    %Clicker{}
    |> Clicker.changeset(attrs)
    |> Repo.insert()
  end

  def inc(%Clicker{} = clicker) do
    change(clicker, 1)
  end

  def dec(%Clicker{} = clicker) do
    change(clicker, -1)
  end

  defp change(%Clicker{id: id}, value) do
    case Repo.transaction(fn ->
           clicker = Repo.get!(Clicker, id)

           Clicker.changeset(clicker, %{count: clicker.count + value})
           |> Repo.update!()
         end) do
      {:ok, clicker} -> broadcast(clicker)
      {:error, _} -> :ok
    end
  end

  @doc """
  Deletes a clicker.

  ## Examples

      iex> delete_clicker(clicker)
      {:ok, %Clicker{}}

      iex> delete_clicker(clicker)
      {:error, %Ecto.Changeset{}}

  """
  def delete_clicker(%Clicker{} = clicker) do
    Repo.delete(clicker)
  end

  def subscribe(id) do
    PubSub.subscribe(ClickEx.PubSub, "clicker:#{id}")
  end

  def broadcast(%Clicker{id: id} = clicker) do
    PubSub.broadcast(ClickEx.PubSub, "clicker:#{id}", clicker)
  end
end
